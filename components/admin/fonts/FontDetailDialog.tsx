"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminFontFamily, AdminFontVariant } from "@/lib/admin/templates-data";
import { FontDropZone } from "./FontDropZone";
import { FontPreview } from "./FontPreview";

type Props = {
  family: AdminFontFamily | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFamilyUpdated: (family: AdminFontFamily) => void;
  onFamilyDeleted: (familyId: string) => void;
};

const STYLE_OPTIONS = [
  { value: "NORMAL", key: "labels.styleNormal" },
  { value: "ITALIC", key: "labels.styleItalic" },
];

const UNSET_STYLE_VALUE = "__unset_style__";

type FormState = {
  name: string;
  slug: string;
  defaultWeight: string;
  defaultStyle: string | null;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  defaultWeight: "",
  defaultStyle: null,
  notes: "",
};

export function FontDetailDialog({ family, open, onOpenChange, onFamilyUpdated, onFamilyDeleted }: Props) {
  const t = useTranslations("admin.fonts");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isDeletingFamily, setIsDeletingFamily] = useState(false);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantDeletingId, setVariantDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (family) {
      setForm({
        name: family.name ?? "",
        slug: family.slug ?? "",
        defaultWeight: family.defaultWeight ? String(family.defaultWeight) : "",
        defaultStyle: family.defaultStyle ?? null,
        notes: family.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setSaveError(null);
    setSaveSuccess(null);
    setVariantError(null);
    setVariantMessage(null);
  }, [family]);

  const styleLabels = useMemo(
    () => ({
      NORMAL: t("labels.styleNormal"),
      ITALIC: t("labels.styleItalic"),
    }),
    [t],
  );

  const variantRows = useMemo(() => family?.variants ?? [], [family?.variants]);

  const previewVariant = useMemo(() => {
    if (!family || family.variants.length === 0) return null;
    const defaultW = family.defaultWeight ?? 400;
    const defaultS = family.defaultStyle ?? "NORMAL";
    return (
      family.variants.find((v) => v.weight === defaultW && v.style === defaultS) ??
      family.variants.find((v) => v.weight === defaultW) ??
      family.variants[0]
    );
  }, [family]);

  const handleFieldChange = <Key extends keyof FormState>(field: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!family) return;
    if (!form.name.trim()) {
      setSaveError(t("errors.nameRequired"));
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      defaultWeight: form.defaultWeight.trim() ? Number(form.defaultWeight.trim()) : null,
      defaultStyle: form.defaultStyle ?? null,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    try {
      const response = await fetch(`/api/admin/fonts/${family.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.family) {
        throw new Error(data?.error ?? t("detail.errors.updateFailed"));
      }

      onFamilyUpdated(data.family as AdminFontFamily);
      setSaveSuccess(t("detail.success"));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("detail.errors.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!family) return;
    if (!window.confirm(t("detail.deleteConfirm", { name: family.name }))) return;

    setIsDeletingFamily(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch(`/api/admin/fonts/${family.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? t("detail.errors.deleteFailed"));
      }

      onOpenChange(false);
      onFamilyDeleted(family.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("detail.errors.deleteFailed"));
    } finally {
      setIsDeletingFamily(false);
    }
  };

  const handleVariantDeleted = async (variant: AdminFontVariant) => {
    setVariantDeletingId(variant.id);
    setVariantError(null);
    setVariantMessage(null);

    try {
      const response = await fetch(`/api/admin/fonts/variants/${variant.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.family) {
        throw new Error(data?.error ?? t("detail.variants.errors.deleteFailed"));
      }

      onFamilyUpdated(data.family as AdminFontFamily);
      setVariantMessage(t("detail.variants.deleteSuccess"));
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : t("detail.variants.errors.deleteFailed"));
    } finally {
      setVariantDeletingId(null);
    }
  };

  const handleVariantUpdate = useCallback(async (variantId: string, data: { weight?: number; style?: string }) => {
    setVariantError(null);
    setVariantMessage(null);
    try {
      const response = await fetch(`/api/admin/fonts/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Update failed");
      if (payload?.family) onFamilyUpdated(payload.family as AdminFontFamily);
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : "Update failed");
    }
  }, [onFamilyUpdated]);

  const handleVariantUploaded = (updatedFamily: AdminFontFamily) => {
    onFamilyUpdated(updatedFamily);
    setVariantError(null);
    setVariantMessage(t("detail.variants.uploadSuccess"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {family ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{family.name}</DialogTitle>
              <DialogDescription>{t("detail.description")}</DialogDescription>
            </DialogHeader>

            {/* Two-panel layout */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] min-h-0">
              {/* Left panel — preview + form */}
              <div className="overflow-y-auto min-h-0 flex flex-col gap-5 p-6">
                {/* Font preview */}
                {previewVariant && (
                  <div className="py-6 bg-slate-50/50 rounded-lg">
                    <FontPreview
                      storageKey={previewVariant.storageKey}
                      format={previewVariant.format}
                      familyName={family.name}
                      weight={previewVariant.weight}
                      style={previewVariant.style}
                      sampleText="The quick brown fox jumps over the lazy dog"
                      className="text-2xl text-slate-900 text-center"
                    />
                    <FontPreview
                      storageKey={previewVariant.storageKey}
                      format={previewVariant.format}
                      familyName={family.name}
                      weight={previewVariant.weight}
                      style={previewVariant.style}
                      sampleText="ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789"
                      className="text-sm text-slate-500 text-center mt-2"
                    />
                  </div>
                )}

                {/* Feedback */}
                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
                )}
                {saveSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveSuccess}</div>
                )}

                {/* Form fields — flat, no cards */}
                <div className="space-y-2">
                  <Label htmlFor="font-detail-name">{t("detail.fields.name")}</Label>
                  <Input
                    id="font-detail-name"
                    value={form.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-detail-slug">{t("detail.fields.slug")}</Label>
                  <Input
                    id="font-detail-slug"
                    value={form.slug}
                    onChange={(event) => handleFieldChange("slug", event.target.value)}
                  />
                  <p className="text-xs text-slate-500">{t("detail.slugHint")}</p>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="font-detail-weight">{t("detail.fields.defaultWeight")}</Label>
                    <Input
                      id="font-detail-weight"
                      type="number"
                      min={100}
                      max={1000}
                      step={50}
                      value={form.defaultWeight}
                      onChange={(event) => handleFieldChange("defaultWeight", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-detail-style">{t("detail.fields.defaultStyle")}</Label>
                    <Select
                      value={form.defaultStyle ?? UNSET_STYLE_VALUE}
                      onValueChange={(value) =>
                        handleFieldChange("defaultStyle", value === UNSET_STYLE_VALUE ? null : value)
                      }
                    >
                      <SelectTrigger id="font-detail-style">
                        <SelectValue placeholder={t("detail.placeholders.defaultStyle")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET_STYLE_VALUE}>{t("create.unset")}</SelectItem>
                        {STYLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.key as any)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-detail-notes">{t("detail.fields.notes")}</Label>
                  <Textarea
                    id="font-detail-notes"
                    value={form.notes}
                    onChange={(event) => handleFieldChange("notes", event.target.value)}
                    rows={3}
                    placeholder={t("detail.placeholders.notes")}
                  />
                </div>
              </div>

              {/* Right panel — variants + uploader */}
              <div className="flex flex-col min-h-0 overflow-hidden border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50/50">
                {/* Variants header */}
                <div className="shrink-0 px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-slate-700">{t("detail.variants.title")}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("detail.variants.description")}</p>
                </div>

                {/* Variant list — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 min-h-0">
                  {variantMessage && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 mb-3">{variantMessage}</div>
                  )}
                  {variantError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">{variantError}</div>
                  )}

                  {variantRows.length === 0 ? (
                    <p className="text-sm text-slate-400">{t("detail.variants.empty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {variantRows.map((variant) => (
                        <div key={variant.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="number"
                                min={100}
                                max={900}
                                step={100}
                                defaultValue={variant.weight}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (v !== variant.weight && v >= 100 && v <= 900) {
                                    handleVariantUpdate(variant.id, { weight: v });
                                  }
                                }}
                                className="w-16 rounded border border-slate-200 px-2 py-0.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                              <span className="text-sm text-slate-400">/</span>
                              <select
                                defaultValue={variant.style}
                                onChange={(e) => handleVariantUpdate(variant.id, { style: e.target.value })}
                                className="rounded border border-slate-200 px-2 py-0.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              >
                                <option value="NORMAL">{styleLabels.NORMAL}</option>
                                <option value="ITALIC">{styleLabels.ITALIC}</option>
                              </select>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                              onClick={() => handleVariantDeleted(variant)}
                              disabled={variantDeletingId === variant.id}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {variant.format} · {variant.fileName ?? "—"} · {formatBytes(variant.sizeBytes)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload — pinned at bottom */}
                <div className="shrink-0 p-5 pt-3">
                  <FontDropZone
                    familyId={family.id}
                    onUploaded={handleVariantUploaded}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 shrink-0">
              <LoadingButton
                variant="ghost"
                size="sm"
                onClick={handleDeleteFamily}
                loading={isDeletingFamily}
                loadingText={t("detail.danger.deleting")}
                minWidthClassName="min-w-[100px]"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" />
                {t("detail.danger.deleteButton")}
              </LoadingButton>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t("actions.cancel")}
                </Button>
                <LoadingButton onClick={handleSave} loading={isSaving} loadingText={t("detail.saving")} minWidthClassName="min-w-[140px]">
                  {t("detail.saveButton")}
                </LoadingButton>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
