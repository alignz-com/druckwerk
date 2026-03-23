"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"

type Props = {
  brandId: string
  canUseTemplates: boolean
  canUploadFiles: boolean
}

export function BrandAccessSection({ brandId, canUseTemplates, canUploadFiles }: Props) {
  const t = useTranslations("admin.products.access")
  const [tpl, setTpl] = useState(canUseTemplates)
  const [upl, setUpl] = useState(canUploadFiles)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = tpl !== canUseTemplates || upl !== canUploadFiles

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canUseTemplates: tpl, canUploadFiles: upl }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError(t("error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{t("title")}</h3>
        <p className="text-xs text-slate-500">{t("description")}</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-emerald-600">{t("saved")}</p>}

      <div className="space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={tpl}
            onChange={(e) => { setTpl(e.target.checked); setSaved(false) }}
            disabled={saving}
          />
          <span className="text-sm text-slate-700">{t("businessCards")}</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={upl}
            onChange={(e) => { setUpl(e.target.checked); setSaved(false) }}
            disabled={saving}
          />
          <span className="text-sm text-slate-700">{t("pdfPrint")}</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasChanges || saving}
          onClick={() => { setTpl(canUseTemplates); setUpl(canUploadFiles); setSaved(false) }}
        >
          {t("reset")}
        </Button>
        <LoadingButton
          type="button"
          size="sm"
          disabled={!hasChanges}
          loading={saving}
          loadingText="…"
          minWidthClassName="min-w-[60px]"
          onClick={handleSave}
        >
          {t("save")}
        </LoadingButton>
      </div>
    </section>
  )
}
