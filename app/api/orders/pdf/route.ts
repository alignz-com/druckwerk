import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PutObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { s3, ORDERS_BUCKET, UPLOADS_BUCKET, S3_PUBLIC_URL } from "@/lib/s3"
import { getBrandsForUser } from "@/lib/brand-access"
import { DELIVERY_OPTIONS } from "@/lib/delivery-options"
import { addBusinessDays } from "@/lib/date-utils"
import { extractAndUploadPdfItem } from "@/lib/pdf-item-extract"
import { generatePdfOrderJdfs } from "@/lib/generate-pdf-order-jdfs"
import { reserveReferenceCode } from "@/lib/order-reference"

const itemMetaSchema = z.object({
  filename: z.string(),
  sourceZipFilename: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  trimWidthMm: z.number().nullable().optional(),
  trimHeightMm: z.number().nullable().optional(),
  bleedMm: z.number().nullable().optional(),
  colorSpaces: z.array(z.string()).default([]),
  pantoneColors: z.array(z.string()).default([]),
  pages: z.number().int().nullable().optional(),
  fileSlot: z.number().int().nullable().optional(),
  stagingUrl: z.string().nullable().optional(),
  thumbnailDataUrl: z.string().nullable().optional(),
  productFormatId: z.string().nullable().optional(),
  paperStockId: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const formData = await req.formData()

    const brandId = formData.get("brandId") as string | null
    const deliveryTime = (formData.get("deliveryTime") as string) ?? "standard"
    const customerReference = (formData.get("customerReference") as string) ?? ""
    const notes = (formData.get("notes") as string) ?? ""
    const itemsMetaRaw = formData.get("itemsMeta") as string | null

    if (!itemsMetaRaw) {
      return NextResponse.json({ error: "itemsMeta is required" }, { status: 400 })
    }

    const itemsMeta = z.array(itemMetaSchema).parse(JSON.parse(itemsMetaRaw))
    if (itemsMeta.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Verify brand access
    const brandOptions = await getBrandsForUser({
      userId,
      role: session.user.role ?? "USER",
      knownBrandId: brandId,
    })
    const resolvedBrandId = brandId && brandOptions.some((b) => b.id === brandId)
      ? brandId
      : brandOptions[0]?.id ?? null

    const brand = resolvedBrandId
      ? brandOptions.find((b) => b.id === resolvedBrandId) ?? null
      : null

    // Demo users: skip all DB writes and file uploads, return a fake success
    if ((session.user as any).isDemo) {
      const fakeRef = `DEMO-${Date.now().toString(36).toUpperCase()}`
      return NextResponse.json({ orderId: "demo", referenceCode: fakeRef })
    }

    const { referenceCode, referenceYear, referenceSequence } = await reserveReferenceCode()

    const cfg = DELIVERY_OPTIONS[deliveryTime as keyof typeof DELIVERY_OPTIONS] ?? DELIVERY_OPTIONS.standard
    const deliveryDueAt = addBusinessDays(new Date(), cfg.businessDays)

    // Collect uploaded source files by slot index
    const sourceFiles = new Map<number, { buffer: Buffer; name: string; mimeType: string }>()
    let slot = 0
    while (true) {
      const f = formData.get(`file_${slot}`) as File | null
      if (!f) break
      const buffer = Buffer.from(await f.arrayBuffer())
      const isZip = f.name.toLowerCase().endsWith(".zip")
      const is7z = f.name.toLowerCase().endsWith(".7z")
      sourceFiles.set(slot, {
        buffer,
        name: f.name,
        mimeType: isZip ? "application/zip" : is7z ? "application/x-7z-compressed" : "application/pdf",
      })
      slot++
    }

    // Determine storage key for each unique source file slot
    const slotStorageKeys = new Map<number, string>()
    for (const [slotIdx, file] of sourceFiles.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      slotStorageKeys.set(slotIdx, `${referenceCode}/src/${safeName}`)
    }

    // Build line items with storage paths
    const S3_ORDERS_BASE = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}`
    const lineItems = itemsMeta.map((meta, i) => {
      const hasStaging = !!meta.stagingUrl
      const slotKey = meta.fileSlot != null ? slotStorageKeys.get(meta.fileSlot) : undefined
      const safeName = meta.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
      // Staging items: individual PDF already in MinIO — final path is pdf/{n}-{name}
      // Fallback items: storagePath = uploaded source file (direct PDF or archive)
      const storagePath = hasStaging
        ? `${referenceCode}/pdf/${i + 1}-${safeName}`
        : (slotKey ?? `${referenceCode}/pdf/${i + 1}-${safeName}`)
      const thumbnailStoragePath = meta.thumbnailDataUrl
        ? `${referenceCode}/thumbs/${i + 1}.png`
        : null
      return {
        filename: meta.filename,
        sourceZipFilename: meta.sourceZipFilename ?? null,
        storagePath,
        thumbnailStoragePath,
        quantity: meta.quantity,
        trimWidthMm: meta.trimWidthMm ?? null,
        trimHeightMm: meta.trimHeightMm ?? null,
        bleedMm: meta.bleedMm ?? null,
        colorSpaces: meta.colorSpaces,
        pantoneColors: meta.pantoneColors,
        pages: meta.pages ?? null,
        productFormatId: meta.productFormatId ?? null,
        coverPaperStockId: meta.paperStockId ?? null,
        _thumbnailDataUrl: meta.thumbnailDataUrl ?? null,
      }
    })

    // Create order + line items in a transaction; create items individually to get their IDs back
    const { order, createdItems } = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          referenceCode,
          referenceYear,
          referenceSequence,
          userId,
          brandId: resolvedBrandId,
          type: "UPLOAD",
          status: "SUBMITTED",
          deliveryTime,
          deliveryDueAt,
          notes: notes || null,
          meta: customerReference ? { customerReference } : undefined,
        },
      })

      const items = []
      for (const { _thumbnailDataUrl: _, ...item } of lineItems) {
        items.push(await tx.pdfOrderItem.create({ data: { ...item, orderId: o.id } }))
      }

      return { order: o, createdItems: items }
    })

    // Upload source files to MinIO (deduplicated by slot)
    for (const [slotIdx, file] of sourceFiles.entries()) {
      const storageKey = slotStorageKeys.get(slotIdx)!
      await s3.send(
        new PutObjectCommand({
          Bucket: ORDERS_BUCKET,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimeType,
          Metadata: { orderId: order.id, originalName: file.name },
        })
      )
    }

    // Upload thumbnails to MinIO
    for (const item of lineItems) {
      if (item.thumbnailStoragePath && item._thumbnailDataUrl) {
        try {
          const base64 = item._thumbnailDataUrl.replace(/^data:image\/\w+;base64,/, "")
          const buffer = Buffer.from(base64, "base64")
          await s3.send(new PutObjectCommand({
            Bucket: ORDERS_BUCKET,
            Key: item.thumbnailStoragePath,
            Body: buffer,
            ContentType: "image/png",
          }))
        } catch { /* non-critical, thumbnail missing is fine */ }
      }
    }

    // Copy staging files server-side from the uploads bucket to the orders bucket.
    // These were already uploaded during preflight — no client re-upload needed.
    await Promise.allSettled(
      itemsMeta.map(async (meta, i) => {
        if (!meta.stagingUrl) return
        const stagingKey = meta.stagingUrl.replace(`${S3_PUBLIC_URL}/${UPLOADS_BUCKET}/`, "")
        const finalKey = createdItems[i].storagePath!
        try {
          await s3.send(new CopyObjectCommand({
            Bucket: ORDERS_BUCKET,
            CopySource: `${UPLOADS_BUCKET}/${stagingKey}`,
            Key: finalKey,
          }))
          await prisma.pdfOrderItem.update({
            where: { id: createdItems[i].id },
            data: { pdfUrl: `${S3_ORDERS_BASE}/${finalKey}` },
          })
        } catch (err) {
          console.error(`[orders/pdf] CopyObject failed for ${meta.filename}:`, err)
        }
      })
    )

    // Extract individual PDFs from archives and store with order-prefixed names.
    // Runs concurrently; failures are non-fatal — the archive remains the source of truth.
    // Staging items (storagePath ends in .pdf, not .7z/.zip) are skipped by the guard below.
    await Promise.allSettled(
      createdItems.map(async (item) => {
        if (!item.storagePath || !item.sourceZipFilename || !/\.(7z|zip)$/i.test(item.storagePath)) return
        try {
          const extracted = await extractAndUploadPdfItem({
            referenceCode,
            archiveStorageKey: item.storagePath,
            archiveName: item.sourceZipFilename,
            originalFilename: item.filename,
          })
          await prisma.pdfOrderItem.update({
            where: { id: item.id },
            data: { pdfUrl: extracted.pdfUrl, pdfFileName: extracted.pdfFileName },
          })
        } catch (err) {
          console.error(`[orders/pdf] failed to extract PDF for item ${item.id}:`, err)
        }
      })
    )

    // Auto-generate JDFs in the background — non-blocking, failures are non-fatal
    generatePdfOrderJdfs(order.id, { name: session.user.name, email: session.user.email }).catch((err) =>
      console.error("[orders/pdf] JDF generation failed:", err)
    )

    return NextResponse.json({ orderId: order.id, referenceCode })
  } catch (err) {
    console.error("[orders/pdf] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
