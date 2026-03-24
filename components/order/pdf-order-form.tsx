"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PrintFileUploader, type SortableFile } from "@/components/print-file-uploader"
import type { ProductFormatForMatching } from "@/lib/product-matching"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingButton } from "@/components/ui/loading-button"
import { estimateDeliveryDate } from "@/lib/delivery-options"
import { useTranslations } from "@/components/providers/locale-provider"

type Brand = { id: string; name: string }

type Props = {
  availableBrands: Brand[]
  initialBrandId: string | null
  products: ProductFormatForMatching[]
  isDemo?: boolean
}

export function PdfOrderForm({ availableBrands, initialBrandId, products, isDemo = false }: Props) {
  const router = useRouter()
  const t = useTranslations()

  const [brandId, setBrandId] = React.useState<string>(initialBrandId ?? availableBrands[0]?.id ?? "")
  const [deliveryTime, setDeliveryTime] = React.useState<"standard" | "express">("standard")
  const [customerReference, setCustomerReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [files, setFiles] = React.useState<SortableFile[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const estimatedDate = estimateDeliveryDate(deliveryTime)
  const estimatedLabel = estimatedDate.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  const canSubmit = files.length > 0 && files.every((f) => !f.error) && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      // Build multipart form — files + metadata
      const formData = new FormData()
      formData.append("brandId", brandId)
      formData.append("deliveryTime", deliveryTime)
      formData.append("customerReference", customerReference)
      formData.append("notes", notes)

      // Files that were preflighted already have a staging URL in MinIO (previewUrl).
      // For those we skip the re-upload and let the server do a cheap server-side CopyObject.
      // Only files without a staging URL (preflight failed / edge case) fall back to direct upload.
      const uploadedFileNames = new Map<string, number>()
      let slotIndex = 0
      const sourceSlots: File[] = []

      const itemsMeta = files.map((f) => {
        let fileSlot: number | null = null
        if (f._sourceFile && !f.previewUrl) {
          // No staging URL — fall back to uploading the file directly
          const key = f._sourceFile.name
          if (!uploadedFileNames.has(key)) {
            uploadedFileNames.set(key, slotIndex)
            sourceSlots.push(f._sourceFile)
            fileSlot = slotIndex
            slotIndex++
          } else {
            fileSlot = uploadedFileNames.get(key)!
          }
        }
        return {
          filename: f.filename,
          sourceZipFilename: f.fromZip ?? null,
          quantity: f.quantity,
          trimWidthMm: f.trimWidthMm,
          trimHeightMm: f.trimHeightMm,
          bleedMm: f.bleedMm,
          colorSpaces: f.colorSpaces,
          pantoneColors: f.pantoneColors,
          pages: f.pages,
          fileSlot,
          stagingUrl: f.previewUrl ?? null,
          thumbnailDataUrl: f.thumbnailDataUrl ?? null,
          productFormatId: f.productFormatId ?? null,
        }
      })
      formData.append("itemsMeta", JSON.stringify(itemsMeta))
      sourceSlots.forEach((file, i) => formData.append(`file_${i}`, file))

      const res = await fetch("/api/orders/pdf", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      await res.json()
      router.push("/orders?created=1")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setSubmitting(false)
    }
  }

  const tOrder = useTranslations("orderForm")

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isDemo ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {tOrder("demoBanner")}
        </div>
      ) : null}
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pdfOrder.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pdfOrder.subtitle")}
        </p>
      </div>

      {/* Order info strip */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-muted/20 p-4">
        {/* Brand — only shown if multiple brands available */}
        {availableBrands.length > 1 && (
          <div className="space-y-1.5 w-40 shrink-0">
            <Label>{t("pdfOrder.brand")}</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Delivery toggle */}
        <div className="space-y-1.5 shrink-0">
          <Label>{t("pdfOrder.delivery")}</Label>
          <div className="flex w-fit gap-2">
            {(["standard", "express"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDeliveryTime(value)}
                className={`flex flex-col items-center justify-center rounded-xl border-2 px-5 py-2.5 transition-all ${
                  deliveryTime === value
                    ? "border-slate-400 bg-background shadow-sm"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-slate-300 hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-semibold leading-none">{t(`orderForm.deliveryTimeLabels.${value}`)}</span>
                <span className="text-xs mt-1 opacity-70">{t(`orderForm.deliveryTimeDurations.${value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div className="space-y-1.5 w-44 shrink-0">
          <Label>{t("pdfOrder.reference")}</Label>
          <Input
            value={customerReference}
            onChange={(e) => setCustomerReference(e.target.value)}
            placeholder={t("pdfOrder.referencePlaceholder")}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label>{t("pdfOrder.notes")}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("pdfOrder.notesPlaceholder")}
            className="resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* Delivery info */}
      <div className="text-xs text-muted-foreground -mt-4">
        <span>{t("pdfOrder.estimatedDelivery")}: {estimatedLabel}</span>
        {deliveryTime === "express" && (
          <span className="text-destructive ml-2">{t("pdfOrder.expressNotice")}</span>
        )}
      </div>

      {/* Drop zone + file list */}
      <PrintFileUploader files={files} onChange={setFiles} products={products} />

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("pdfOrder.cancel")}
        </Button>
        <LoadingButton
          type="submit"
          disabled={!canSubmit}
          loading={submitting}
        >
          {t("pdfOrder.submit")} {files.length > 0 && `(${files.length})`}
        </LoadingButton>
      </div>
    </form>
  )
}
