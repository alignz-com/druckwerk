"use client"

import * as React from "react"
import { Plus, Ruler, Search, Trash2 } from "lucide-react"
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
import { useTranslations } from "@/components/providers/locale-provider"

type Format = {
  id: string
  name: string
  nameDe: string | null
  slug: string
  trimWidthMm: number
  trimHeightMm: number
  defaultBleedMm: number
  toleranceMm: number
  createdAt: string | Date
  _count?: { productFormats: number }
}

type FormState = {
  name: string
  nameDe: string
  slug: string
  trimWidthMm: string
  trimHeightMm: string
  defaultBleedMm: string
  toleranceMm: string
}

const emptyForm = (): FormState => ({
  name: "",
  nameDe: "",
  slug: "",
  trimWidthMm: "",
  trimHeightMm: "",
  defaultBleedMm: "3",
  toleranceMm: "1",
})

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function AdminFormatsView({ initialFormats }: { initialFormats: Format[] }) {
  const t = useTranslations("admin.formats")
  const [formats, setFormats] = React.useState<Format[]>(initialFormats)
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return formats
    return formats.filter((f) =>
      [f.name, f.nameDe, f.slug].some((v) => v?.toLowerCase().includes(q))
    )
  }, [formats, search])
  const [dialog, setDialog] = React.useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/formats")
    if (res.ok) setFormats(await res.json())
    setLoading(false)
  }


  function openCreate() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
    setDialog("create")
  }

  function openEdit(f: Format) {
    setForm({
      name: f.name,
      nameDe: f.nameDe ?? "",
      slug: f.slug,
      trimWidthMm: String(f.trimWidthMm),
      trimHeightMm: String(f.trimHeightMm),
      defaultBleedMm: String(f.defaultBleedMm),
      toleranceMm: String(f.toleranceMm),
    })
    setEditingId(f.id)
    setError(null)
    setDialog("edit")
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "name" && dialog === "create") {
        next.slug = slugify(value)
      }
      return next
    })
  }

  function formToPayload() {
    return {
      name: form.name.trim(),
      nameDe: form.nameDe.trim() || null,
      slug: form.slug.trim() || slugify(form.name),
      trimWidthMm: parseFloat(form.trimWidthMm),
      trimHeightMm: parseFloat(form.trimHeightMm),
      defaultBleedMm: parseFloat(form.defaultBleedMm) || 3,
      toleranceMm: parseFloat(form.toleranceMm) || 1,
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = formToPayload()
      const url = dialog === "edit" ? `/api/admin/formats/${editingId}` : "/api/admin/formats"
      const method = dialog === "edit" ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Error")
      }
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
    const res = await fetch(`/api/admin/formats/${id}`, { method: "DELETE" })
    if (res.status === 409) {
      alert(t("deleteBlocked"))
      return
    }
    if (!res.ok) {
      alert(t("deleteFailed"))
      return
    }
    await load()
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="size-4" aria-hidden="true" />
          {t("newFormat")}
        </Button>
      </header>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("loading")}</p>
      ) : formats.length === 0 && !search ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Ruler className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div>
          <div className={dataTableContainerClass}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableRowClass}>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.dimensions")}</TableHead>
                <TableHead>{t("table.bleed")}</TableHead>
                <TableHead>{t("table.tolerance")}</TableHead>
                <TableHead>{t("table.variants")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">{t("noResults")}</TableCell>
                </TableRow>
              ) : filtered.map((f) => (
                <TableRow
                  key={f.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => openEdit(f)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{f.name}</div>
                      {f.nameDe && <div className="text-xs text-slate-500">{f.nameDe}</div>}
                      <div className="text-xs text-slate-400 font-mono">{f.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{f.trimWidthMm} × {f.trimHeightMm} mm</TableCell>
                  <TableCell className="text-sm text-slate-600">{f.defaultBleedMm} mm</TableCell>
                  <TableCell className="text-sm text-slate-600">± {f.toleranceMm} mm</TableCell>
                  <TableCell className="text-sm text-slate-600">{f._count?.productFormats ?? 0}</TableCell>
                  <TableCell className="w-10 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-destructive"
                      onClick={() => handleDelete(f.id)}
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

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? t("editFormat") : t("newFormat")}</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("fields.name")}</Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.nameDe")}</Label>
                <Input value={form.nameDe} onChange={(e) => setField("nameDe", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("fields.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">{t("fields.slugHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("fields.trimWidthMm")}</Label>
                <Input type="number" value={form.trimWidthMm} onChange={(e) => setField("trimWidthMm", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.trimHeightMm")}</Label>
                <Input type="number" value={form.trimHeightMm} onChange={(e) => setField("trimHeightMm", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("fields.defaultBleedMm")}</Label>
                <Input type="number" value={form.defaultBleedMm} onChange={(e) => setField("defaultBleedMm", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.toleranceMm")}</Label>
                <Input type="number" value={form.toleranceMm} onChange={(e) => setField("toleranceMm", e.target.value)} />
                <p className="text-xs text-slate-500">{t("fields.toleranceHint")}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "…" : dialog === "edit" ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
