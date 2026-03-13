"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PdfDropzone, type SortableFile } from "@/components/pdf-dropzone"
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
}

export function PdfOrderForm({ availableBrands, initialBrandId }: Props) {
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

      // Deduplicate source files: each unique File object is uploaded once.
      // Direct PDFs get their own slot; ZIP-extracted files share the parent archive.
      const uploadedFileNames = new Map<string, number>()
      let slotIndex = 0
      const sourceSlots: File[] = []

      const itemsMeta = files.map((f) => {
        let fileSlot: number | null = null
        if (f._sourceFile) {
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

      const { orderId } = await res.json()
      router.push(`/orders/${orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border bg-muted/20 p-4">
        {/* Brand — only shown if multiple brands available */}
        {availableBrands.length > 1 && (
          <div className="space-y-1.5">
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

        {/* Delivery */}
        <div className="space-y-1.5">
          <Label>{t("pdfOrder.delivery")}</Label>
          <Select value={deliveryTime} onValueChange={(v) => setDeliveryTime(v as "standard" | "express")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">{t("pdfOrder.deliveryStandard")}</SelectItem>
              <SelectItem value="express">{t("pdfOrder.deliveryExpress")}</SelectItem>
            </SelectContent>
          </Select>
          {deliveryTime === "express" && (
            <p className="text-xs text-destructive">{t("pdfOrder.expressNotice")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("pdfOrder.estimatedDelivery")}: {estimatedLabel}
          </p>
        </div>

        {/* Reference */}
        <div className="space-y-1.5">
          <Label>{t("pdfOrder.reference")}</Label>
          <Input
            value={customerReference}
            onChange={(e) => setCustomerReference(e.target.value)}
            placeholder={t("pdfOrder.referencePlaceholder")}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>{t("pdfOrder.notes")}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("pdfOrder.notesPlaceholder")}
            className="min-h-[38px] resize-none"
            rows={1}
          />
        </div>
      </div>

      {/* Drop zone + file list */}
      <PdfDropzone files={files} onChange={setFiles} />

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
