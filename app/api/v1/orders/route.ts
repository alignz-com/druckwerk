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

export const runtime = "nodejs"
export const maxDuration = 120

const ALLOWED_EXTENSIONS = [".pdf", ".zip", ".7z"]

function isArchive(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith(".zip") || lower.endsWith(".7z")
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

    // 4. Extract archives to discover individual PDFs; plain PDFs pass through
    const S3_ORDERS_BASE = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}`

    type PreparedItem = {
      filename: string
      sourceZipFilename: string | null
      quantity: number
      buffer: Buffer
      storageKey: string
    }

    const items: PreparedItem[] = []

    for (const file of files) {
      if (isArchive(file.name)) {
        // Extract archive to discover PDFs
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

        // Also upload the source archive
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
          })
        }
      } else {
        // Plain PDF
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        items.push({
          filename: file.name,
          sourceZipFilename: null,
          quantity: file.quantity,
          buffer: file.buffer,
          storageKey: `${referenceCode}/pdf/${items.length + 1}-${safeName}`,
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
              pdfUrl: `${S3_ORDERS_BASE}/${item.storageKey}`,
              pdfFileName: item.filename,
            },
          })
        )
      }

      return { order: o, createdItems: created }
    })

    // 6. Upload all PDFs to MinIO
    await Promise.all(
      items.map((item) =>
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
      )
    )

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
