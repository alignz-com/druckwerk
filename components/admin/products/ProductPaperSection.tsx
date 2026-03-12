"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

type PaperStock = { id: string; name: string; description: string | null; finish: string | null; weightGsm: number | null }

type Props = { productId: string }

export function ProductPaperSection({ productId }: Props) {
  const [allPapers, setAllPapers] = React.useState<PaperStock[]>([])
  const [assigned, setAssigned] = React.useState<Set<string>>(new Set())
  const [original, setOriginal] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/admin/paper-stocks").then((r) => r.json()),
      fetch(`/api/admin/products/${productId}/papers`).then((r) => r.json()),
    ]).then(([all, assigned]: [{ paperStocks: PaperStock[] }, PaperStock[]]) => {
      setAllPapers(all.paperStocks ?? [])
      const ids = new Set(assigned.map((p) => p.id))
      setAssigned(new Set(ids))
      setOriginal(new Set(ids))
    }).catch(() => {})
  }, [productId])

  const hasChanges = assigned.size !== original.size || [...assigned].some((id) => !original.has(id))

  function toggle(id: string) {
    setAssigned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/papers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperStockIds: [...assigned] }),
      })
      if (!res.ok) throw new Error()
      setOriginal(new Set(assigned))
      setSaved(true)
    } catch {
      setError("Could not save paper stocks.")
    } finally {
      setSaving(false)
    }
  }

  if (allPapers.length === 0) return (
    <div className="pt-2 border-t">
      <p className="text-xs font-medium text-muted-foreground mb-1">Paper Stocks</p>
      <p className="text-xs text-muted-foreground/60">No paper stocks defined yet.</p>
    </div>
  )

  return (
    <div className="pt-2 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Available Paper Stocks</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {saved && <p className="text-xs text-emerald-600">Saved.</p>}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {allPapers.map((p) => (
          <label key={p.id} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={assigned.has(p.id)}
              onChange={() => toggle(p.id)}
              disabled={saving}
            />
            <span className="text-sm text-slate-700 leading-tight">
              {p.name}
              {(p.weightGsm || p.finish) && (
                <span className="text-xs text-muted-foreground ml-1">
                  {[p.weightGsm ? `${p.weightGsm}gsm` : null, p.finish].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button" variant="ghost" size="sm"
          disabled={!hasChanges || saving}
          onClick={() => { setAssigned(new Set(original)); setSaved(false) }}
        >
          Reset
        </Button>
        <Button type="button" size="sm" disabled={!hasChanges || saving} onClick={save}>
          {saving ? "Saving…" : "Save papers"}
        </Button>
      </div>
    </div>
  )
}
