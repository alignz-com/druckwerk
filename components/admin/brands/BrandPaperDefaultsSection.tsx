"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ProductOption = { id: string; name: string; type: string }
type PaperStock = { id: string; name: string; weightGsm: number | null; finish: string | null }
type ProductPapers = Record<string, PaperStock[]> // productId → available papers
type DefaultEntry = { productId: string; paperStockId: string }

type Props = { brandId: string }

export function BrandPaperDefaultsSection({ brandId }: Props) {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productPapers, setProductPapers] = useState<ProductPapers>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({}) // productId → paperStockId
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/products").then((r) => r.json()),
      fetch(`/api/admin/brands/${brandId}/paper-defaults`).then((r) => r.json()),
    ]).then(async ([allProducts, currentDefaults]: [ProductOption[], DefaultEntry[]]) => {
      setProducts(allProducts)
      const d: Record<string, string> = {}
      currentDefaults.forEach((e) => { d[e.productId] = e.paperStockId })
      setDefaults({ ...d })
      setOriginal({ ...d })

      // Fetch available papers for each product
      const papersMap: ProductPapers = {}
      await Promise.all(
        allProducts.map(async (p) => {
          const papers = await fetch(`/api/admin/products/${p.id}/papers`).then((r) => r.json())
          papersMap[p.id] = papers
        })
      )
      setProductPapers(papersMap)
    }).catch(() => {})
  }, [brandId])

  const productsWithPapers = products.filter((p) => (productPapers[p.id]?.length ?? 0) > 0)

  if (productsWithPapers.length === 0) return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">Default Paper</h3>
      <p className="text-xs text-slate-400">Assign paper stocks to products first.</p>
    </section>
  )

  const hasChanges = JSON.stringify(defaults) !== JSON.stringify(original)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const body: DefaultEntry[] = Object.entries(defaults)
        .filter(([, paperStockId]) => !!paperStockId)
        .map(([productId, paperStockId]) => ({ productId, paperStockId }))
      const res = await fetch(`/api/admin/brands/${brandId}/paper-defaults`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: body }),
      })
      if (!res.ok) throw new Error()
      setOriginal({ ...defaults })
      setSaved(true)
    } catch {
      setError("Could not save defaults.")
    } finally {
      setSaving(false)
    }
  }

  function paperLabel(p: PaperStock) {
    const detail = [p.weightGsm ? `${p.weightGsm}gsm` : null, p.finish].filter(Boolean).join(" · ")
    return detail ? `${p.name} (${detail})` : p.name
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Default Paper</h3>
        <p className="text-xs text-slate-500">Default paper stock per product for this brand.</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-emerald-600">Saved.</p>}

      <div className="space-y-3">
        {productsWithPapers.map((product) => {
          const papers = productPapers[product.id] ?? []
          const current = defaults[product.id] ?? "none"
          return (
            <div key={product.id} className="space-y-1">
              <p className="text-xs font-medium text-slate-600">{product.name}</p>
              <Select
                value={current}
                onValueChange={(v) => {
                  setDefaults((prev) => ({ ...prev, [product.id]: v === "none" ? "" : v }))
                  setSaved(false)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{paperLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button" variant="ghost" size="sm"
          disabled={!hasChanges || saving}
          onClick={() => { setDefaults({ ...original }); setSaved(false) }}
        >
          Reset
        </Button>
        <Button type="button" size="sm" disabled={!hasChanges || saving} onClick={save}>
          {saving ? "Saving…" : "Save defaults"}
        </Button>
      </div>
    </section>
  )
}
