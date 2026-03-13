"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Layers } from "lucide-react"
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
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"

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

export function AdminPaperStocksClient() {
  const t = useTranslations("admin.papers")
  const [papers, setPapers] = React.useState<PaperStock[]>([])
  const [loading, setLoading] = React.useState(true)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> {t("newPaper")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : papers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.name")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.weight")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.finish")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("table.color")}</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.description && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.weightGsm != null ? `${p.weightGsm} g/m²` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.finish ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.color ?? "—"}</td>
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
