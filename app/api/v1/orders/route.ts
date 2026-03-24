/**
 * POST /api/v1/orders
 *
 * External ingest endpoint for automated order submission.
 * Accepts multipart/form-data with files + per-file quantities.
 * Authenticated via Bearer API key (ApiKey model).
 *
 * Form fields:
 *   files        — one or more PDF, ZIP, or 7Z files (repeated field name)
 *   quantities   — quantity for each file, in the same order (repeated field name)
 *   notes        — optional order notes
 *   customerReference — optional external reference (e.g. sales order number)
 *
 * Example curl:
 *   curl -X POST https://api.dth.at/v1/orders \
 *     -H "Authorization: Bearer TOKEN" \
 *     -F "files=@manual1.pdf" -F "quantities=100" \
 *     -F "files=@manual2.pdf" -F "quantities=50"
 */
import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"

import { authenticateApiKey } from "@/lib/api-key-auth"
import { prisma } from "@/lib/prisma"
import { s3, ORDERS_BUCKET, S3_PUBLIC_URL } from "@/lib/s3"
import { reserveReferenceCode } from "@/lib/order-reference"
import { DELIVERY_OPTIONS } from "@/lib/delivery-options"
import { addBusinessDays } from "@/lib/date-utils"
import { generatePdfOrderJdfs } from "@/lib/generate-pdf-order-jdfs"
import {
  extract7zBuffer,
  extractZipBuffer,
  buildPdfFileName,
} from "@/lib/pdf-item-extract"
import { analyzePdf } from "@/lib/pdf-analyze"
import {
  matchProductFormat,
  type ProductFormatForMatching,
} from "@/lib/product-matching"

export const runtime = "nodejs"
export const maxDuration = 120

const ALLOWED_EXTENSIONS = [".pdf", ".zip", ".7z"]

function isArchive(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith(".zip") || lower.endsWith(".7z")
}

/** Load all ProductFormats for dimension-based matching. */
async function loadProductFormats(): Promise<ProductFormatForMatching[]> {
  const pfs = await prisma.productFormat.findMany({
    include: {
      product: true,
      format: true,
    },
  })
  return pfs.map((pf) => ({
    id: pf.id,
    productId: pf.productId,
    productName: pf.product.name,
    productNameEn: pf.product.nameEn,
    productNameDe: pf.product.nameDe,
    formatName: pf.format.name,
    formatNameDe: pf.format.nameDe,
    trimWidthMm: pf.format.trimWidthMm,
    trimHeightMm: pf.format.trimHeightMm,
    toleranceMm: pf.format.toleranceMm ?? 2,
    defaultBleedMm: pf.format.defaultBleedMm ?? 3,
    minPages: pf.minPages,
    maxPages: pf.maxPages,
  }))
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const apiKey = await authenticateApiKey(req)
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { brandId } = apiKey

  try {
    // Find or create a dedicated service user for API orders on this brand
    const serviceEmail = `api@${apiKey.brand.slug}.service`
    const brandUser = await prisma.user.upsert({
      where: { email: serviceEmail },
      update: {},
      create: {
        email: serviceEmail,
        name: "API",
        brandId,
        role: "API",
      },
    })

    const formData = await req.formData()

    const notes = (formData.get("notes") as string) ?? ""
    const customerReference = (formData.get("customerReference") as string) ?? ""

    // 2. Parse files + quantities (repeated field names)
    const rawFiles = formData.getAll("files") as File[]
    const rawQuantities = formData.getAll("quantities").map((v) => parseInt(String(v), 10))

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files provided. Use the "files" field.' },
        { status: 400 }
      )
    }

    if (rawQuantities.length !== rawFiles.length) {
      return NextResponse.json(
        {
          error: `Mismatch: ${rawFiles.length} file(s) but ${rawQuantities.length} quantity value(s). Provide one "quantities" per "files".`,
        },
        { status: 400 }
      )
    }

    const files: Array<{ buffer: Buffer; name: string; quantity: number }> = []
    for (let i = 0; i < rawFiles.length; i++) {
      const f = rawFiles[i]
      const quantity = rawQuantities[i]

      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${f.name}. Allowed: PDF, ZIP, 7Z` },
          { status: 400 }
        )
      }

      if (!quantity || quantity < 1) {
        return NextResponse.json(
          { error: `Invalid quantity for file ${f.name}: ${rawQuantities[i]}` },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await f.arrayBuffer())
      files.push({ buffer, name: f.name, quantity })
    }

    // 3. Reserve reference code
    const { referenceCode, referenceYear, referenceSequence } =
      await reserveReferenceCode()

    const cfg = DELIVERY_OPTIONS.standard
    const deliveryDueAt = addBusinessDays(new Date(), cfg.businessDays)

    // Load product formats for auto-matching
    const productFormats = await loadProductFormats()

    // 4. Extract archives, analyze PDFs, match products
    const S3_ORDERS_BASE = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}`

    type PreparedItem = {
      filename: string
      sourceZipFilename: string | null
      quantity: number
      buffer: Buffer
      storageKey: string
      trimWidthMm: number | null
      trimHeightMm: number | null
      bleedMm: number | null
      pages: number | null
      colorSpaces: string[]
      pantoneColors: string[]
      thumbnailDataUrl: string | undefined
      productFormatId: string | null
    }

    const items: PreparedItem[] = []

    for (const file of files) {
      if (isArchive(file.name)) {
        const is7z = file.name.toLowerCase().endsWith(".7z")
        const pdfs = is7z
          ? await extract7zBuffer(file.buffer)
          : await extractZipBuffer(file.buffer)

        if (pdfs.length === 0) {
          return NextResponse.json(
            { error: `No PDFs found in archive: ${file.name}` },
            { status: 400 }
          )
        }

        // Upload the source archive
        const safeArchiveName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const archiveKey = `${referenceCode}/src/${safeArchiveName}`
        await s3.send(
          new PutObjectCommand({
            Bucket: ORDERS_BUCKET,
            Key: archiveKey,
            Body: file.buffer,
            ContentType: is7z
              ? "application/x-7z-compressed"
              : "application/zip",
          })
        )

        for (const pdf of pdfs) {
          const analysis = await analyzePdf(pdf.buffer)
          const match = analysis.trimWidthMm > 0
            ? matchProductFormat(analysis.trimWidthMm, analysis.trimHeightMm, analysis.pages, productFormats)
            : null

          const pdfFileName = buildPdfFileName(
            referenceCode,
            file.name,
            pdf.filename
          )
          items.push({
            filename: pdf.filename,
            sourceZipFilename: file.name,
            quantity: file.quantity,
            buffer: pdf.buffer,
            storageKey: `${referenceCode}/pdfs/${pdfFileName}`,
            trimWidthMm: analysis.trimWidthMm || null,
            trimHeightMm: analysis.trimHeightMm || null,
            bleedMm: analysis.bleedMm,
            pages: analysis.pages || null,
            colorSpaces: analysis.colorSpaces,
            pantoneColors: analysis.pantoneColors,
            thumbnailDataUrl: analysis.thumbnailDataUrl,
            productFormatId: match?.id ?? null,
          })
        }
      } else {
        // Plain PDF — analyze
        const analysis = await analyzePdf(file.buffer)
        const match = analysis.trimWidthMm > 0
          ? matchProductFormat(analysis.trimWidthMm, analysis.trimHeightMm, analysis.pages, productFormats)
          : null

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        items.push({
          filename: file.name,
          sourceZipFilename: null,
          quantity: file.quantity,
          buffer: file.buffer,
          storageKey: `${referenceCode}/pdf/${items.length + 1}-${safeName}`,
          trimWidthMm: analysis.trimWidthMm || null,
          trimHeightMm: analysis.trimHeightMm || null,
          bleedMm: analysis.bleedMm,
          pages: analysis.pages || null,
          colorSpaces: analysis.colorSpaces,
          pantoneColors: analysis.pantoneColors,
          thumbnailDataUrl: analysis.thumbnailDataUrl,
          productFormatId: match?.id ?? null,
        })
      }
    }

    // 5. Create order + items in a transaction
    const { order, createdItems } = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          referenceCode,
          referenceYear,
          referenceSequence,
          userId: brandUser.id,
          brandId,
          type: "UPLOAD",
          status: "SUBMITTED",
          deliveryTime: "standard",
          deliveryDueAt,
          notes: notes || null,
          meta: customerReference ? { customerReference } : undefined,
        },
      })

      const created = []
      for (const item of items) {
        created.push(
          await tx.pdfOrderItem.create({
            data: {
              orderId: o.id,
              filename: item.filename,
              sourceZipFilename: item.sourceZipFilename,
              storagePath: item.storageKey,
              quantity: item.quantity,
              trimWidthMm: item.trimWidthMm,
              trimHeightMm: item.trimHeightMm,
              bleedMm: item.bleedMm,
              pages: item.pages,
              colorSpaces: item.colorSpaces,
              pantoneColors: item.pantoneColors,
              pdfUrl: `${S3_ORDERS_BASE}/${item.storageKey}`,
              pdfFileName: item.filename,
              productFormatId: item.productFormatId,
              thumbnailStoragePath: item.thumbnailDataUrl
                ? `${referenceCode}/thumbs/${created.length + 1}.jpg`
                : null,
            },
          })
        )
      }

      return { order: o, createdItems: created }
    })

    // 6. Upload PDFs + thumbnails to MinIO
    await Promise.all([
      // Upload PDFs
      ...items.map((item) =>
        s3.send(
          new PutObjectCommand({
            Bucket: ORDERS_BUCKET,
            Key: item.storageKey,
            Body: item.buffer,
            ContentType: "application/pdf",
            Metadata: {
              orderId: order.id,
              originalName: item.filename,
            },
          })
        )
      ),
      // Upload thumbnails
      ...items.map(async (item, i) => {
        if (!item.thumbnailDataUrl) return
        const base64 = item.thumbnailDataUrl.replace(/^data:image\/\w+;base64,/, "")
        const thumbBuffer = Buffer.from(base64, "base64")
        const thumbKey = `${referenceCode}/thumbs/${i + 1}.jpg`
        await s3.send(
          new PutObjectCommand({
            Bucket: ORDERS_BUCKET,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: "image/jpeg",
          })
        )
      }),
    ])

    // 7. Generate JDFs (fire-and-forget)
    generatePdfOrderJdfs(order.id, {
      name: brandUser.name,
      email: brandUser.email,
    }).catch((err) =>
      console.error("[v1/orders] JDF generation failed:", err)
    )

    return NextResponse.json({
      orderId: order.id,
      referenceCode,
      items: createdItems.map((i) => ({
        id: i.id,
        filename: i.filename,
        quantity: i.quantity,
        trimWidthMm: i.trimWidthMm,
        trimHeightMm: i.trimHeightMm,
        bleedMm: i.bleedMm,
        pages: i.pages,
        colorSpaces: i.colorSpaces,
        pantoneColors: i.pantoneColors,
        productFormatId: i.productFormatId,
      })),
    })
  } catch (err) {
    console.error("[v1/orders] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
