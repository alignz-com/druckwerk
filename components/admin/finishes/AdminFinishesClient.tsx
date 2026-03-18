"use client"

import * as React from "react"
import { Plus, Trash2, Sparkles, Search, ChevronLeft, ChevronRight } from "lucide-react"
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
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"

const PAGE_SIZE = 10

type Finish = {
  id: string
  name: string
  nameDe: string | null
  code: string | null
}

type FormState = {
  name: string
  nameDe: string
  code: string
}

const emptyForm: FormState = { name: "", nameDe: "", code: "" }

export function AdminFinishesClient({ autoOpen }: { autoOpen?: boolean }) {
  const t = useTranslations("admin.finishes")
  const [finishes, setFinishes] = React.useState<Finish[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(0)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return finishes
    return finishes.filter((f) =>
      [f.name, f.nameDe, f.code].some((v) => v?.toLowerCase().includes(q))
    )
  }, [finishes, search])

  React.useEffect(() => { setPage(0) }, [search, finishes])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const to = filtered.length === 0 ? 0 : Math.min(filtered.length, (page + 1) * PAGE_SIZE)
  const [dialog, setDialog] = React.useState<"create" | { edit: Finish } | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/finishes")
    const data = await res.json()
    setFinishes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])
  React.useEffect(() => { if (autoOpen) openCreate() }, [autoOpen])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialog("create")
  }

  function openEdit(f: Finish) {
    setForm({ name: f.name, nameDe: f.nameDe ?? "", code: f.code ?? "" })
    setError(null)
    setDialog({ edit: f })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        nameDe: form.nameDe || null,
        code: form.code || null,
      }
      const id = dialog !== null && dialog !== "create" ? dialog.edit.id : null
      const res = await fetch(id ? `/api/admin/finishes/${id}` : "/api/admin/finishes", {
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
      const res = await fetch(`/api/admin/finishes/${id}`, { method: "DELETE" })
      if (!res.ok) alert(t("deleteFailed"))
    } finally {
      setDeleting(null)
      await load()
    }
  }

  const field = (key: keyof FormState) => ({
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
          {t("newFinish")}
        </Button>
      </header>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("loading")}</p>
      ) : finishes.length === 0 && !search ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div>
          <div className={dataTableContainerClass}>
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableRowClass}>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.nameDe")}</TableHead>
                <TableHead>{t("table.code")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">{t("noResults")}</TableCell>
                </TableRow>
              ) : pageData.map((f) => (
                <TableRow
                  key={f.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => openEdit(f)}
                >
                  <TableCell className="font-semibold text-slate-900">{f.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">{f.nameDe ?? "—"}</TableCell>
                  <TableCell>
                    {f.code ? (
                      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-mono font-medium text-slate-500">
                        {f.code}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="w-10 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-destructive"
                      onClick={() => handleDelete(f.id)}
                      disabled={deleting === f.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
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
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? t("newFinish") : t("editFinish")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("fields.name")}</Label>
              <Input {...field("name")} placeholder={t("fields.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.nameDe")}</Label>
              <Input {...field("nameDe")} placeholder={t("fields.nameDePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fields.code")}</Label>
              <Input {...field("code")} placeholder={t("fields.codePlaceholder")} />
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
