import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { s3, ORDERS_BUCKET } from "@/lib/s3"
import { getBrandsForUser } from "@/lib/brand-access"
import { DELIVERY_OPTIONS } from "@/lib/delivery-options"
import { addBusinessDays } from "@/lib/date-utils"
import { extractAndUploadPdfItem } from "@/lib/pdf-item-extract"

export const runtime = "nodejs"
export const maxDuration = 120

function formatReferenceCode(year: number, sequence: number) {
  return `${year}-${sequence.toString().padStart(5, "0")}`
}

async function reserveReferenceCode() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const counter = await prisma.$transaction((tx) =>
    tx.orderReferenceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    })
  )
  return {
    referenceCode: formatReferenceCode(year, counter.lastValue),
    referenceYear: year,
    referenceSequence: counter.lastValue,
  }
}

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
  thumbnailDataUrl: z.string().nullable().optional(),
  productFormatId: z.string().nullable().optional(),
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
      slotStorageKeys.set(slotIdx, `orders/${referenceCode}/src/${safeName}`)
    }

    // Build line items with storage paths
    const lineItems = itemsMeta.map((meta, i) => {
      const slotKey = meta.fileSlot != null ? slotStorageKeys.get(meta.fileSlot) : undefined
      const safeName = meta.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
      // For direct PDFs: storagePath = the uploaded file path
      // For ZIP-extracted: storagePath = same as archive path (file lives inside it)
      const storagePath = slotKey ?? `orders/${referenceCode}/pdf/${i + 1}-${safeName}`
      const thumbnailStoragePath = meta.thumbnailDataUrl
        ? `orders/${referenceCode}/thumbs/${i + 1}.png`
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
        _thumbnailDataUrl: meta.thumbnailDataUrl ?? null,
      }
    })

    // Create order + line items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          referenceCode,
          referenceYear,
          referenceSequence,
          userId,
          brandId: resolvedBrandId,
          type: "PDF_PRINT",
          status: "SUBMITTED",
          deliveryTime,
          deliveryDueAt,
          notes: notes || null,
          meta: customerReference ? { customerReference } : undefined,
        },
      })

      await tx.pdfOrderItem.createMany({
        data: lineItems.map(({ _thumbnailDataUrl: _, ...item }) => ({ ...item, orderId: o.id })),
      })

      return o
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

    // Extract individual PDFs from archives and store with order-prefixed names.
    // Runs concurrently; failures are non-fatal — the archive remains the source of truth.
    const orderItems = await prisma.pdfOrderItem.findMany({ where: { orderId: order.id } })
    await Promise.allSettled(
      orderItems.map(async (item) => {
        if (!item.storagePath || !item.sourceZipFilename) return
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

    return NextResponse.json({ orderId: order.id, referenceCode })
  } catch (err) {
    console.error("[orders/pdf] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
