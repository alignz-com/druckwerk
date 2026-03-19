"use client"

import * as React from "react"
import { Plus, Trash2, Layers, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"

const PAGE_SIZE = 10

type PaperStock = {
  id: string
  name: string
  description: string | null
  finish: string | null
  color: string | null
  weightGsm: number | null
  createdAt: string
}

type FormState = {
  name: string
  description: string
  finish: string
  color: string
  weightGsm: string
}

const emptyForm: FormState = {
  name: "",
  description: "",
  finish: "",
  color: "",
  weightGsm: "",
}

export function AdminPaperStocksClient({ autoOpen }: { autoOpen?: boolean }) {
  const t = useTranslations("admin.papers")
  const [papers, setPapers] = React.useState<PaperStock[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [finishFilter, setFinishFilter] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(0)

  const availableFinishes = React.useMemo(() => {
    const seen = new Set<string>()
    for (const p of papers) {
      if (p.finish) seen.add(p.finish)
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [papers])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return papers.filter((p) => {
      if (finishFilter && p.finish !== finishFilter) return false
      if (q && ![p.name, p.description, p.finish, p.color].some((v) => v?.toLowerCase().includes(q))) return false
      return true
    })
  }, [papers, search, finishFilter])

  React.useEffect(() => { setPage(0) }, [search, finishFilter, papers])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const to = filtered.length === 0 ? 0 : Math.min(filtered.length, (page + 1) * PAGE_SIZE)
  const [dialog, setDialog] = React.useState<"create" | { edit: PaperStock } | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/paper-stocks")
    const data = await res.json()
    setPapers(data.paperStocks ?? [])
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])
  React.useEffect(() => { if (autoOpen) openCreate() }, [autoOpen])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialog("create")
  }

  function openEdit(p: PaperStock) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      finish: p.finish ?? "",
      color: p.color ?? "",
      weightGsm: p.weightGsm != null ? String(p.weightGsm) : "",
    })
    setError(null)
    setDialog({ edit: p })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        finish: form.finish || null,
        color: form.color || null,
        weightGsm: form.weightGsm ? parseInt(form.weightGsm) : null,
      }
      const id = dialog !== null && dialog !== "create" ? dialog.edit.id : null
      const res = await fetch(id ? `/api/admin/paper-stocks/${id}` : "/api/admin/paper-stocks", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? t("saveFailed"))
      }
      await load()
      setDialog(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/paper-stocks/${id}`, { method: "DELETE" })
      if (!res.ok) alert(t("deleteFailed"))
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="size-4" aria-hidden="true" />
          {t("newPaper")}
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
        </div>
        {availableFinishes.length > 0 && (
          <Select value={finishFilter ?? "all"} onValueChange={(v) => setFinishFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("allFinishes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allFinishes")}</SelectItem>
              {availableFinishes.map((finish) => (
                <SelectItem key={finish} value={finish}>{finish}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("loading")}</p>
      ) : papers.length === 0 && !search ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Layers className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div>
          <div className={dataTableContainerClass}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableRowClass}>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.weight")}</TableHead>
                <TableHead>{t("table.finish")}</TableHead>
                <TableHead>{t("table.color")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">{t("noResults")}</TableCell>
                </TableRow>
              ) : pageData.map((p) => (
                <TableRow
                  key={p.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => openEdit(p)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-slate-500">{p.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {p.weightGsm != null ? `${p.weightGsm} g/m²` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{p.finish ?? "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{p.color ?? "—"}</TableCell>
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

      <div className={dataTableFooterClass}>
        <div>{t("pagination.label", { from, to, total: filtered.length })}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-9">
            <ChevronLeft className="mr-1 h-4 w-4" />{t("pagination.previous")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || filtered.length === 0} className="h-9">
            {t("pagination.next")}<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? t("newPaper") : t("editPaper")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("fields.name")}</Label>
              <Input {...f("name")} placeholder={t("fields.namePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("fields.weight")}</Label>
                <Input {...f("weightGsm")} type="number" step="1" placeholder="350" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.finish")}</Label>
                <Input {...f("finish")} placeholder={t("fields.finishPlaceholder")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.color")}</Label>
              <Input {...f("color")} placeholder={t("fields.colorPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.description")}</Label>
              <Input {...f("description")} placeholder={t("fields.descriptionPlaceholder")} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
