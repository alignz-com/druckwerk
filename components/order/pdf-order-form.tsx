"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PrintFileUploader, type SortableFile } from "@/components/print-file-uploader"
import type { ProductFormatForMatching } from "@/lib/product-matching"
import { resolveAllowedQuantities } from "@/lib/order-quantities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  const [showExpressConfirm, setShowExpressConfirm] = React.useState(false)
  const [customerReference, setCustomerReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [files, setFiles] = React.useState<SortableFile[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch upload quantity restrictions for the selected brand
  const [uploadQuantityOptions, setUploadQuantityOptions] = React.useState<number[] | null>(null)
  React.useEffect(() => {
    if (!brandId) { setUploadQuantityOptions(null); return }
    fetch(`/api/orders/brand-data?brandId=${brandId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { setUploadQuantityOptions(null); return }
        const resolved = resolveAllowedQuantities({
          quantityMin: data.uploadQuantityMin ?? null,
          quantityMax: data.uploadQuantityMax ?? null,
          quantityStep: data.uploadQuantityStep ?? null,
          quantityOptions: data.uploadQuantityOptions ?? null,
        })
        // If resolved equals DEFAULT_ORDER_QUANTITIES (no brand config), treat as unrestricted
        setUploadQuantityOptions(
          data.uploadQuantityMin != null || data.uploadQuantityMax != null ||
          (data.uploadQuantityOptions?.length > 0)
            ? resolved
            : null
        )
      })
      .catch(() => setUploadQuantityOptions(null))
  }, [brandId])

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
          paperStockId: f.paperStockId ?? null,
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
    <>
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

      {/* Order info — compact strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2.5">
        {/* Brand */}
        {availableBrands.length > 1 && (
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 rounded-md text-sm">
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
        )}

        {/* Delivery toggle */}
        <div className="flex h-9 rounded-md border border-input overflow-hidden">
          {(["standard", "express"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (value === "express" && deliveryTime !== "express") {
                  setShowExpressConfirm(true)
                } else {
                  setDeliveryTime(value)
                }
              }}
              className={`px-3 text-xs font-medium transition-colors cursor-pointer ${
                deliveryTime === value
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span>{t(`orderForm.deliveryTimeLabels.${value}`)}</span>
              <span className="block text-[10px] opacity-60">{t(`orderForm.deliveryTimeDurations.${value}`)}</span>
            </button>
          ))}
        </div>

        {/* Spacer to push inputs right */}
        <div className="flex-1" />

        {/* Reference */}
        <Input
          value={customerReference}
          onChange={(e) => setCustomerReference(e.target.value)}
          placeholder={t("pdfOrder.referencePlaceholder")}
          className="w-44 h-9 rounded-md text-sm"
        />

        {/* Notes */}
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("pdfOrder.notesPlaceholder")}
          className="w-56 h-9 rounded-md text-sm"
        />
      </div>

      {/* Drop zone + file list */}
      <PrintFileUploader files={files} onChange={setFiles} products={products} brandId={brandId} allowedQuantities={uploadQuantityOptions} />

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

    {/* Express delivery confirmation dialog */}
    <AlertDialog open={showExpressConfirm} onOpenChange={setShowExpressConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pdfOrder.expressConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("pdfOrder.expressConfirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("pdfOrder.expressConfirmCancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => setDeliveryTime("express")}>
            {t("pdfOrder.expressConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
