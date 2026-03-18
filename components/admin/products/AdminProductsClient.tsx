"use client"

import * as React from "react"
import { Plus, Trash2, Package, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"
import { ProductFormatsSection } from "./ProductFormatsSection"

type Product = {
  id: string
  name: string
  nameEn: string | null
  nameDe: string | null
  description: string | null
  type: "BUSINESS_CARD" | "PDF_PRINT"
  trimWidthMm: number | null
  trimHeightMm: number | null
  canvasWidthMm: number | null
  canvasHeightMm: number | null
  printDpi: number | null
  pcmCode: string | null
  createdAt: string
  _count?: { productFormats: number }
}

type FormState = {
  name: string
  nameEn: string
  nameDe: string
  description: string
  type: "BUSINESS_CARD" | "PDF_PRINT"
  trimWidthMm: string
  trimHeightMm: string
  canvasWidthMm: string
  canvasHeightMm: string
  printDpi: string
  pcmCode: string
}

const emptyForm: FormState = {
  name: "", nameEn: "", nameDe: "", description: "", type: "PDF_PRINT",
  trimWidthMm: "", trimHeightMm: "", canvasWidthMm: "", canvasHeightMm: "", printDpi: "", pcmCode: "",
}

export function AdminProductsView({ autoOpen }: { autoOpen?: boolean }) {
  const t = useTranslations("admin.products")
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      [p.name, p.nameEn, p.nameDe].some((v) => v?.toLowerCase().includes(q))
    )
  }, [products, search])
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
  React.useEffect(() => { if (autoOpen) openCreate() }, [autoOpen])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialog("create")
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      nameEn: p.nameEn ?? "",
      nameDe: p.nameDe ?? "",
      description: p.description ?? "",
      type: p.type,
      trimWidthMm: p.trimWidthMm != null ? String(p.trimWidthMm) : "",
      trimHeightMm: p.trimHeightMm != null ? String(p.trimHeightMm) : "",
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
        body: JSON.stringify({
          name: form.name,
          nameEn: form.nameEn || null,
          nameDe: form.nameDe || null,
          description: form.description || null,
          ...(id ? {} : { type: form.type }),
          ...(id ? {
            trimWidthMm: form.trimWidthMm ? parseFloat(form.trimWidthMm) : null,
            trimHeightMm: form.trimHeightMm ? parseFloat(form.trimHeightMm) : null,
            canvasWidthMm: form.canvasWidthMm ? parseFloat(form.canvasWidthMm) : null,
            canvasHeightMm: form.canvasHeightMm ? parseFloat(form.canvasHeightMm) : null,
            printDpi: form.printDpi ? parseInt(form.printDpi) : null,
            pcmCode: form.pcmCode || null,
          } : {}),
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `Error ${res.status}`)
      }
      await load()
      if (dialog === "create") setDialog(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("save"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        alert(b.error ?? t("deleteFailed"))
      }
    } finally {
      setDeleting(null)
      await load()
    }
  }

  const f = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="size-4" aria-hidden="true" />
          {t("newProduct")}
        </Button>
      </header>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("loading")}</p>
      ) : products.length === 0 && !search ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Package className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div>
          <div className={dataTableContainerClass}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableRowClass}>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>Format Variants</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-12 text-center text-sm text-slate-500">{t("noResults")}</TableCell>
                </TableRow>
              ) : filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => openEdit(p)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      {p.nameDe && <div className="text-xs text-slate-500">{p.nameDe}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {p._count?.productFormats ?? 0}
                  </TableCell>
                  <TableCell className="w-10 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? t("newProduct") : t("editProduct")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialog === "create" && (
              <div className="space-y-1.5">
                <Label>{t("fields.type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as FormState["type"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF_PRINT">{t("types.PDF_PRINT")}</SelectItem>
                    <SelectItem value="BUSINESS_CARD">{t("types.BUSINESS_CARD")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("fields.name")}</Label>
              <Input {...f("name")} placeholder="e.g. Flyer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.nameEn")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">EN</span>
                  <Input {...f("nameEn")} className="pl-8" placeholder="Flyer" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.nameDe")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">DE</span>
                  <Input {...f("nameDe")} className="pl-8" placeholder="Flyer" />
                </div>
              </div>
            </div>

            {dialog !== null && dialog !== "create" && form.type === "BUSINESS_CARD" && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Print Specifications</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("fields.widthMm")}</Label>
                    <Input {...f("trimWidthMm")} type="number" step="0.1" placeholder="55" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fields.heightMm")}</Label>
                    <Input {...f("trimHeightMm")} type="number" step="0.1" placeholder="85" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("fields.canvasWidthMm")}</Label>
                    <Input {...f("canvasWidthMm")} type="number" step="0.1" placeholder="58" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fields.canvasHeightMm")}</Label>
                    <Input {...f("canvasHeightMm")} type="number" step="0.1" placeholder="88" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("fields.printDpi")}</Label>
                    <Input {...f("printDpi")} type="number" step="1" placeholder="300" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fields.pcmCode")}</Label>
                    <Input {...f("pcmCode")} className="font-mono text-sm" placeholder="pcm_vk_standard" />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <LoadingButton loading={saving} onClick={handleSave}>
              {dialog === "create" ? t("create") : t("save")}
            </LoadingButton>
          </DialogFooter>

          {dialog !== null && dialog !== "create" && (
            <div className="border-t pt-4 mt-2">
              <ProductFormatsSection productId={dialog.edit.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
