"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations } from "@/components/providers/locale-provider"

type Props = {
  userId: string
}

export function AdminPasswordReset({ userId }: Props) {
  const t = useTranslations("admin.users.detail.passwordReset")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSave = password.length >= 8 && password === confirm && !saving

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t("error"))
      }
      setSaved(true)
      setPassword("")
      setConfirm("")
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"))
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
        <Input
          type="password"
          placeholder={t("newPassword")}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setSaved(false) }}
          disabled={saving}
        />
        {tooShort && (
          <p className="text-xs text-red-500">{t("tooShort")}</p>
        )}
        <Input
          type="password"
          placeholder={t("confirmPassword")}
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setSaved(false) }}
          disabled={saving}
        />
        {mismatch && (
          <p className="text-xs text-red-500">{t("mismatch")}</p>
        )}
      </div>

      <div className="flex justify-end">
        <LoadingButton
          type="button"
          size="sm"
          disabled={!canSave}
          loading={saving}
          loadingText="…"
          minWidthClassName="min-w-[100px]"
          onClick={handleSave}
        >
          {t("save")}
        </LoadingButton>
      </div>
    </section>
  )
}
