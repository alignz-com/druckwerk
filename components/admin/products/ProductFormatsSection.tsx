"use client"

import * as React from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "@/components/providers/locale-provider"

type Format = { id: string; name: string; trimWidthMm: number; trimHeightMm: number }
type PaperStock = { id: string; name: string; weightGsm: number | null; finish: string | null }
type Finish = { id: string; name: string }

type ProductFormatPaper = {
  id: string
  paperStockId: string
  role: string | null
  isDefault: boolean
  paperStock: PaperStock
}

type ProductFormatFinish = {
  id: string
  finishId: string
  isDefault: boolean
  finish: Finish
}

type ProductFormat = {
  id: string
  formatId: string
  format: Format
  pcmCode: string | null
  printDpi: number | null
  productionSteps: string[]
  minPages: number | null
  maxPages: number | null
  isActive: boolean
  papers: ProductFormatPaper[]
  finishes: ProductFormatFinish[]
}

type VariantFormState = {
  formatId: string
  pcmCode: string
  printDpi: string
  productionSteps: string
  minPages: string
  maxPages: string
  isActive: boolean
}

type PaperEntry = { paperStockId: string; role: string | null; isDefault: boolean }

const emptyVariantForm = (): VariantFormState => ({
  formatId: "",
  pcmCode: "",
  printDpi: "",
  productionSteps: "",
  minPages: "",
  maxPages: "",
  isActive: true,
})

export function ProductFormatsSection({ productId }: { productId: string }) {
  const t = useTranslations("admin.productFormats")
  const [variants, setVariants] = React.useState<ProductFormat[]>([])
  const [formats, setFormats] = React.useState<Format[]>([])
  const [allPapers, setAllPapers] = React.useState<PaperStock[]>([])
  const [allFinishes, setAllFinishes] = React.useState<Finish[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialog, setDialog] = React.useState<"add" | { edit: ProductFormat } | null>(null)
  const [variantForm, setVariantForm] = React.useState<VariantFormState>(emptyVariantForm())
  const [paperEntries, setPaperEntries] = React.useState<PaperEntry[]>([])
  const [selectedFinishIds, setSelectedFinishIds] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [variantsRes, formatsRes, papersRes, finishesRes] = await Promise.all([
      fetch(`/api/admin/products/${productId}/formats`),
      fetch("/api/admin/formats"),
      fetch("/api/admin/paper-stocks"),
      fetch("/api/admin/finishes"),
    ])
    if (variantsRes.ok) setVariants(await variantsRes.json())
    if (formatsRes.ok) setFormats(await formatsRes.json())
    if (papersRes.ok) setAllPapers((await papersRes.json()).paperStocks ?? [])
    if (finishesRes.ok) setAllFinishes(await finishesRes.json())
    setLoading(false)
  }

  React.useEffect(() => { load() }, [productId])

  function openAdd() {
    setVariantForm(emptyVariantForm())
    setPaperEntries([])
    setSelectedFinishIds([])
    setError(null)
    setDialog("add")
  }

  function openEdit(v: ProductFormat) {
    setVariantForm({
      formatId: v.formatId,
      pcmCode: v.pcmCode ?? "",
      printDpi: v.printDpi != null ? String(v.printDpi) : "",
      productionSteps: v.productionSteps.join(", "),
      minPages: v.minPages != null ? String(v.minPages) : "",
      maxPages: v.maxPages != null ? String(v.maxPages) : "",
      isActive: v.isActive,
    })
    setPaperEntries(v.papers.map((p) => ({ paperStockId: p.paperStockId, role: p.role, isDefault: p.isDefault })))
    setSelectedFinishIds(v.finishes.map((f) => f.finishId))
    setError(null)
    setDialog({ edit: v })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const isEdit = dialog !== null && dialog !== "add"
      const variantPayload = {
        formatId: variantForm.formatId,
        pcmCode: variantForm.pcmCode || null,
        printDpi: variantForm.printDpi ? parseInt(variantForm.printDpi) : null,
        productionSteps: variantForm.productionSteps
          ? variantForm.productionSteps.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        minPages: variantForm.minPages ? parseInt(variantForm.minPages) : null,
        maxPages: variantForm.maxPages ? parseInt(variantForm.maxPages) : null,
        isActive: variantForm.isActive,
      }

      let variantId: string
      if (isEdit) {
        const id = (dialog as { edit: ProductFormat }).edit.id
        const res = await fetch(`/api/admin/product-formats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variantPayload),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error")
        variantId = id
      } else {
        const res = await fetch(`/api/admin/products/${productId}/formats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variantPayload),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error")
        const data = await res.json()
        variantId = data.id
      }

      // Save papers
      await fetch(`/api/admin/product-formats/${variantId}/papers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers: paperEntries }),
      })

      // Save finishes
      await fetch(`/api/admin/product-formats/${variantId}/finishes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finishes: selectedFinishIds.map((id) => ({ finishId: id })) }),
      })

      setDialog(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return
    await fetch(`/api/admin/product-formats/${id}`, { method: "DELETE" })
    await load()
  }

  function togglePaper(paperStockId: string) {
    setPaperEntries((prev) => {
      const exists = prev.find((p) => p.paperStockId === paperStockId)
      if (exists) return prev.filter((p) => p.paperStockId !== paperStockId)
      return [...prev, { paperStockId, role: null, isDefault: false }]
    })
  }

  function setPaperRole(paperStockId: string, role: string | null) {
    setPaperEntries((prev) =>
      prev.map((p) => (p.paperStockId === paperStockId ? { ...p, role } : p))
    )
  }

  function toggleFinish(finishId: string) {
    setSelectedFinishIds((prev) =>
      prev.includes(finishId) ? prev.filter((id) => id !== finishId) : [...prev, finishId]
    )
  }

  const needsRoles = paperEntries.length > 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("title")}</p>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("addFormat")}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noFormats")}</p>
      ) : (
        <div className="rounded-lg border divide-y text-sm">
          {variants.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium">{v.format.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {v.format.trimWidthMm} × {v.format.trimHeightMm} mm
                  {v.pcmCode && <> · PCM: {v.pcmCode}</>}
                  {(v.minPages || v.maxPages) && <> · {v.minPages ?? "?"}-{v.maxPages ?? "?"} pg</>}
                </p>
                {v.productionSteps.length > 0 && (
                  <p className="text-xs text-muted-foreground">{v.productionSteps.join(" → ")}</p>
                )}
                <div className="flex gap-2 flex-wrap mt-1">
                  {v.papers.map((p) => (
                    <span key={p.id} className="text-xs bg-muted rounded px-1.5 py-0.5">
                      {p.role ? `${p.role}: ` : ""}{p.paperStock.name}
                    </span>
                  ))}
                  {v.finishes.map((f) => (
                    <span key={f.id} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                      {f.finish.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(v.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "add" ? t("addFormat") : t("editFormat")}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-4">
            {/* Format picker */}
            <div className="space-y-1.5">
              <Label>{t("fields.format")}</Label>
              <Select
                value={variantForm.formatId}
                onValueChange={(v) => setVariantForm((prev) => ({ ...prev, formatId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a format…" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} — {f.trimWidthMm} × {f.trimHeightMm} mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.pcmCode")}</Label>
                <Input
                  value={variantForm.pcmCode}
                  onChange={(e) => setVariantForm((p) => ({ ...p, pcmCode: e.target.value }))}
                  className="font-mono text-sm"
                  placeholder="e.g. FLY_A5_CMYK"
                />
                <p className="text-xs text-muted-foreground">{t("fields.pcmCodeHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.printDpi")}</Label>
                <Input
                  type="number"
                  value={variantForm.printDpi}
                  onChange={(e) => setVariantForm((p) => ({ ...p, printDpi: e.target.value }))}
                  placeholder="300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("fields.productionSteps")}</Label>
              <Input
                value={variantForm.productionSteps}
                onChange={(e) => setVariantForm((p) => ({ ...p, productionSteps: e.target.value }))}
                placeholder="Saddle Stitch, Fold, Cut"
              />
              <p className="text-xs text-muted-foreground">{t("fields.productionStepsHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.minPages")}</Label>
                <Input
                  type="number"
                  value={variantForm.minPages}
                  onChange={(e) => setVariantForm((p) => ({ ...p, minPages: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.maxPages")}</Label>
                <Input
                  type="number"
                  value={variantForm.maxPages}
                  onChange={(e) => setVariantForm((p) => ({ ...p, maxPages: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t("fields.pageRangeHint")}</p>

            {/* Papers */}
            {allPapers.length > 0 && (
              <div className="space-y-2">
                <Label>{t("fields.papers")}</Label>
                <div className="rounded-lg border divide-y">
                  {allPapers.map((paper) => {
                    const entry = paperEntries.find((p) => p.paperStockId === paper.id)
                    const checked = !!entry
                    return (
                      <div key={paper.id} className="flex items-center gap-3 px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePaper(paper.id)}
                        />
                        <span className="flex-1 text-sm">
                          {paper.name}
                          {paper.weightGsm && <span className="text-muted-foreground ml-1">{paper.weightGsm}g</span>}
                          {paper.finish && <span className="text-muted-foreground ml-1">· {paper.finish}</span>}
                        </span>
                        {checked && needsRoles && (
                          <Select
                            value={entry?.role ?? "none"}
                            onValueChange={(v) => setPaperRole(paper.id, v === "none" ? null : v)}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t("fields.roleNone")}</SelectItem>
                              <SelectItem value="cover">{t("fields.roleCover")}</SelectItem>
                              <SelectItem value="content">{t("fields.roleContent")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Finishes */}
            {allFinishes.length > 0 && (
              <div className="space-y-2">
                <Label>{t("fields.finishes")}</Label>
                <div className="rounded-lg border divide-y">
                  {allFinishes.map((finish) => (
                    <div key={finish.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selectedFinishIds.includes(finish.id)}
                        onCheckedChange={() => toggleFinish(finish.id)}
                      />
                      <span className="text-sm">{finish.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !variantForm.formatId}>
              {saving ? "…" : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
