"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { AdminBrandSummary, AdminBrandTemplateLink } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BrandTemplateSectionProps = {
  brandId: string | null | undefined;
  templates: AdminBrandTemplateLink[];
  defaultTemplateId: string | null;
  onBrandUpdated?: (brand: AdminBrandSummary) => void;
};

export default function BrandTemplateSection({ brandId, templates, defaultTemplateId, onBrandUpdated }: BrandTemplateSectionProps) {
  const t = useTranslations("admin.brands");
  const [items, setItems] = useState<AdminBrandTemplateLink[]>(templates);
  const [currentDefault, setCurrentDefault] = useState<string | null>(defaultTemplateId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setItems(templates);
    setCurrentDefault(defaultTemplateId ?? null);
    setError(null);
    setSuccess(null);
  }, [templates, defaultTemplateId]);

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((entry, idx) => ({ ...entry, orderIndex: idx }));
    });
    setError(null);
    setSuccess(null);
  };

  const handleDefaultChange = (templateId: string | null) => {
    setCurrentDefault(templateId);
    setError(null);
    setSuccess(null);
  };

  const handleReset = () => {
    setItems(templates);
    setCurrentDefault(defaultTemplateId ?? null);
    setError(null);
    setSuccess(null);
  };

  const hasChanges = useMemo(() => {
    if ((defaultTemplateId ?? null) !== (currentDefault ?? null)) return true;
    if (items.length !== templates.length) return true;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i]?.templateId !== templates[i]?.templateId) {
        return true;
      }
    }
    return false;
  }, [items, templates, currentDefault, defaultTemplateId]);

  const handleSave = async () => {
    if (!brandId || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/brands/${brandId}/templates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTemplateId: currentDefault,
          orderedTemplateIds: items.map((item) => item.templateId),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("detail.templates.saveError"));
      }
      setSuccess(t("detail.templates.saveSuccess"));
      onBrandUpdated?.(data.brand as AdminBrandSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.templates.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!brandId) {
    return (
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.templates.title")}</h3>
          <p className="text-xs text-slate-500">{t("detail.templates.disabled")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.templates.title")}</h3>
        <p className="text-xs text-slate-500">{t("detail.sections.templates.description")}</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{t("detail.templates.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const isDefault = currentDefault === item.templateId;
            return (
              <li
                key={item.assignmentId}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.templateLabel}</p>
                  <p className="text-xs text-slate-500">{item.templateKey}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0 || isSaving}
                      aria-label={t("detail.templates.moveUp")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1 || isSaving}
                      aria-label={t("detail.templates.moveDown")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <label className={cn("text-xs text-slate-600", isDefault && "font-semibold text-slate-900")}
                    >
                    <input
                      type="radio"
                      name={`brand-default-template-${brandId}`}
                      className="mr-2"
                      checked={isDefault}
                      onChange={() => handleDefaultChange(item.templateId)}
                      disabled={isSaving}
                    />
                    {t("detail.templates.defaultLabel")}
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleDefaultChange(null)}
          disabled={isSaving}
        >
          {t("detail.templates.noDefault")}
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={isSaving || !hasChanges}>
          {t("detail.templates.reset")}
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? t("detail.templates.saving") : t("detail.templates.save")}
        </Button>
      </div>
    </section>
  );
}
