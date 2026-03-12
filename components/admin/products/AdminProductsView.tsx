"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"
import { ProductPaperSection } from "./ProductPaperSection"

type Product = {
  id: string
  name: string
  description: string | null
  type: "BUSINESS_CARD" | "PDF_PRINT"
  trimWidthMm: number
  trimHeightMm: number
  toleranceMm: number
  expectedBleedMm: number | null
  canvasWidthMm: number | null
  canvasHeightMm: number | null
  printDpi: number | null
  pcmCode: string | null
  createdAt: string
  _count?: { pdfOrderItems: number }
}

type FormState = {
  name: string
  description: string
  type: "BUSINESS_CARD" | "PDF_PRINT"
  trimWidthMm: string
  trimHeightMm: string
  toleranceMm: string
  expectedBleedMm: string
  canvasWidthMm: string
  canvasHeightMm: string
  printDpi: string
  pcmCode: string
}

const emptyForm: FormState = {
  name: "",
  description: "",
  type: "PDF_PRINT",
  trimWidthMm: "",
  trimHeightMm: "",
  toleranceMm: "1",
  expectedBleedMm: "",
  canvasWidthMm: "",
  canvasHeightMm: "",
  printDpi: "",
  pcmCode: "",
}

function formToPayload(form: FormState) {
  return {
    name: form.name,
    description: form.description,
    type: form.type,
    trimWidthMm: parseFloat(form.trimWidthMm),
    trimHeightMm: parseFloat(form.trimHeightMm),
    toleranceMm: parseFloat(form.toleranceMm) || 1,
    expectedBleedMm: form.expectedBleedMm ? parseFloat(form.expectedBleedMm) : null,
    canvasWidthMm: form.canvasWidthMm ? parseFloat(form.canvasWidthMm) : null,
    canvasHeightMm: form.canvasHeightMm ? parseFloat(form.canvasHeightMm) : null,
    printDpi: form.printDpi ? parseInt(form.printDpi) : null,
    pcmCode: form.pcmCode || null,
  }
}

export function AdminProductsView() {
  const t = useTranslations("admin.products")
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialog, setDialog] = React.useState<"create" | { edit: Product } | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/products")
    setProducts(await res.json())
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialog("create")
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      type: p.type,
      trimWidthMm: String(p.trimWidthMm),
      trimHeightMm: String(p.trimHeightMm),
      toleranceMm: String(p.toleranceMm),
      expectedBleedMm: p.expectedBleedMm != null ? String(p.expectedBleedMm) : "",
      canvasWidthMm: p.canvasWidthMm != null ? String(p.canvasWidthMm) : "",
      canvasHeightMm: p.canvasHeightMm != null ? String(p.canvasHeightMm) : "",
      printDpi: p.printDpi != null ? String(p.printDpi) : "",
      pcmCode: p.pcmCode ?? "",
    })
    setError(null)
    setDialog({ edit: p })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const id = dialog !== null && dialog !== "create" ? dialog.edit.id : null
      const res = await fetch(id ? `/api/admin/products/${id}` : "/api/admin/products", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `Error ${res.status}`)
      }
      await load()
      setDialog(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("save"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("empty"))) return
    setDeleting(id)
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" })
    setDeleting(null)
    await load()
  }

  const f = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> {t("newProduct")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.name")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.type")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.format")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.bleed")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.pcmCode")}</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.type === "BUSINESS_CARD" ? "default" : "secondary"} className="text-xs">
                      {t(`types.${p.type}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.trimWidthMm} × {p.trimHeightMm} mm
                    <span className="ml-1 text-muted-foreground/60">(±{p.toleranceMm})</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.expectedBleedMm != null ? `${p.expectedBleedMm} mm` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.pcmCode ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? t("newProduct") : t("editProduct")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("fields.name")}</Label>
              <Input {...f("name")} placeholder="e.g. A5 Flyer" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.type")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as FormState["type"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF_PRINT">{t("types.PDF_PRINT")}</SelectItem>
                  <SelectItem value="BUSINESS_CARD">{t("types.BUSINESS_CARD")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.widthMm")}</Label>
                <Input {...f("trimWidthMm")} type="number" step="0.1" placeholder="148" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.heightMm")}</Label>
                <Input {...f("trimHeightMm")} type="number" step="0.1" placeholder="210" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.toleranceMm")}</Label>
                <Input {...f("toleranceMm")} type="number" step="0.1" placeholder="1" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.expectedBleedMm")}</Label>
                <Input {...f("expectedBleedMm")} type="number" step="0.1" placeholder="3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.canvasWidthMm")}</Label>
                <Input {...f("canvasWidthMm")} type="number" step="0.1" placeholder="80" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.canvasHeightMm")}</Label>
                <Input {...f("canvasHeightMm")} type="number" step="0.1" placeholder="50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.printDpi")}</Label>
              <Input {...f("printDpi")} type="number" step="1" placeholder="300" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.pcmCode")}</Label>
              <Input {...f("pcmCode")} placeholder="e.g. BC_85x55_CMYK" className="font-mono" />
              <p className="text-xs text-muted-foreground">{t("fields.pcmCodeHint")}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {dialog !== null && dialog !== "create" && (
              <ProductPaperSection productId={dialog.edit.id} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <LoadingButton loading={saving} onClick={handleSave}>
              {dialog === "create" ? t("create") : t("save")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
