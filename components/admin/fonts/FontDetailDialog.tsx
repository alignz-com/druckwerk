"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminFontFamily, AdminFontVariant } from "@/lib/admin/templates-data";
import { formatDateTime } from "@/lib/formatDateTime";
import FontVariantUploader from "./FontVariantUploader";
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

  // Pick best variant for preview: match default weight/style, or first available
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
      const response = await fetch(`/api/admin/fonts/variants/${variant.id}`, {
        method: "DELETE",
      });

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

  const handleVariantUploaded = (updatedFamily: AdminFontFamily) => {
    onFamilyUpdated(updatedFamily);
    setVariantError(null);
    setVariantMessage(t("detail.variants.uploadSuccess"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {family ? (
          <>
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
              <DialogTitle>{family.name}</DialogTitle>
              <DialogDescription>{t("detail.description")}</DialogDescription>
            </DialogHeader>

            {/* Font preview */}
            {previewVariant && (
              <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <FontPreview
                  storageKey={previewVariant.storageKey}
                  format={previewVariant.format}
                  familyName={family.name}
                  weight={previewVariant.weight}
                  style={previewVariant.style}
                  className="text-2xl text-slate-900 text-center"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 space-y-6 min-h-0">
              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {saveSuccess}
                </div>
              )}

              {/* General */}
              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <header className="space-y-1">
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="space-y-2 md:col-span-2">
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
              </section>

              {/* Variants */}
              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <header className="space-y-1">
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.variants.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.variants.description")}</p>
                </header>

                {variantMessage && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {variantMessage}
                  </div>
                )}
                {variantError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {variantError}
                  </div>
                )}

                {variantRows.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("detail.variants.empty")}</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("detail.variants.columns.variant")}</TableHead>
                          <TableHead>{t("detail.variants.columns.format")}</TableHead>
                          <TableHead>{t("detail.variants.columns.file")}</TableHead>
                          <TableHead className="text-right">{t("detail.variants.columns.size")}</TableHead>
                          <TableHead className="text-right">{t("detail.variants.columns.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantRows.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell className="font-medium text-slate-900">
                              {variant.weight} / {styleLabels[variant.style]}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{variant.format}</TableCell>
                            <TableCell className="text-sm text-slate-600">{variant.fileName ?? "—"}</TableCell>
                            <TableCell className="text-right text-sm text-slate-600">
                              {formatBytes(variant.sizeBytes)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleVariantDeleted(variant)}
                                disabled={variantDeletingId === variant.id}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4">
                  <FontVariantUploader
                    family={{ id: family.id, name: family.name, slug: family.slug }}
                    onUploaded={handleVariantUploaded}
                    className="space-y-4"
                  />
                </div>
              </section>

              <Separator />

              {/* Danger zone */}
              <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
                <h2 className="text-sm font-semibold text-red-700">{t("detail.danger.title")}</h2>
                <p className="text-xs text-red-600">{t("detail.danger.description")}</p>
                <LoadingButton
                  variant="destructive"
                  onClick={handleDeleteFamily}
                  loading={isDeletingFamily}
                  loadingText={t("detail.danger.deleting")}
                  minWidthClassName="min-w-[140px]"
                  className="mt-2"
                >
                  {t("detail.danger.deleteButton")}
                </LoadingButton>
              </section>
            </div>

            {/* Footer */}
            <div className="flex justify-between border-t border-slate-200 px-6 py-4 shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("actions.cancel")}
              </Button>
              <LoadingButton onClick={handleSave} loading={isSaving} loadingText={t("detail.saving")} minWidthClassName="min-w-[140px]">
                {t("detail.saveButton")}
              </LoadingButton>
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
