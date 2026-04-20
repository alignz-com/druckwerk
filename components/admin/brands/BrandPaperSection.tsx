"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import type { AdminBrandPaper, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaperStockOption = {
  id: string;
  name: string;
  finish: string | null;
  weightGsm: number | null;
};

export type BrandPaperSectionProps = {
  brandId: string | null | undefined;
  papers: AdminBrandPaper[];
  onBrandUpdated?: (brand: AdminBrandSummary) => void;
};

export default function BrandPaperSection({ brandId, papers, onBrandUpdated }: BrandPaperSectionProps) {
  const t = useTranslations("admin.brands");
  const [allPapers, setAllPapers] = useState<PaperStockOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(papers.map((p) => p.paperStockId)));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync when props change (e.g. after save)
  useEffect(() => {
    setSelectedIds(new Set(papers.map((p) => p.paperStockId)));
    setError(null);
    setSuccess(null);
  }, [papers]);

  // Load all available paper stocks
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/paper-stocks");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.paperStocks ?? data.papers ?? [];
        setAllPapers(
          list.map((p: any) => ({
            id: p.id,
            name: p.name,
            finish: p.finish ?? null,
            weightGsm: p.weightGsm ?? null,
          })),
        );
      } catch {
        // ignore
      }
    })();
  }, []);

  const isDirty = (() => {
    const currentIds = new Set(papers.map((p) => p.paperStockId));
    if (selectedIds.size !== currentIds.size) return true;
    for (const id of selectedIds) {
      if (!currentIds.has(id)) return true;
    }
    return false;
  })();

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!brandId) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/papers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperStockIds: [...selectedIds] }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Refresh brand data
      const brandRes = await fetch(`/api/admin/brands/${brandId}`);
      if (brandRes.ok) {
        const data = await brandRes.json();
        const brand = data.brand ?? data;
        onBrandUpdated?.(brand);
      }
      setSuccess(t("papers.saved"));
    } catch {
      setError(t("papers.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedIds(new Set(papers.map((p) => p.paperStockId)));
    setError(null);
    setSuccess(null);
  };

  const formatPaperLabel = (p: PaperStockOption) => {
    const parts = [p.name];
    if (p.weightGsm) parts.push(`${p.weightGsm}g`);
    if (p.finish) parts.push(p.finish);
    return parts.join(" · ");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("papers.title")}</h2>
          <p className="text-xs text-slate-500">{t("papers.description")}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isDirty && (
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              {t("papers.reset")}
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? t("papers.saving") : t("papers.save")}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      {allPapers.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t("papers.noPapersAvailable")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {allPapers.map((paper) => {
            const selected = selectedIds.has(paper.id);
            return (
              <button
                key={paper.id}
                type="button"
                onClick={() => toggle(paper.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                  selected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                    selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300",
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </div>
                <span className="text-slate-700">{formatPaperLabel(paper)}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        {t("papers.count", { count: selectedIds.size, total: allPapers.length })}
      </p>
    </div>
  );
}
