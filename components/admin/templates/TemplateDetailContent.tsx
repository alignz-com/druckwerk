"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateAssetType } from "@prisma/client";
import { AlertCircle, FileWarning, Trash2 } from "lucide-react";

import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import TemplateAssetUploader from "./TemplateAssetUploader";

const MANAGED_TYPES: TemplateAssetType[] = [
  TemplateAssetType.PDF,
  TemplateAssetType.PREVIEW_FRONT,
  TemplateAssetType.PREVIEW_BACK,
  TemplateAssetType.CONFIG,
];

type Props = {
  template: AdminTemplateSummary;
  onDelete?: (templateId: string) => Promise<void>;
};

export default function TemplateDetailContent({ template, onDelete }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.templates");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState(() => ({
    label: template.label ?? "",
    description: template.description ?? "",
    layoutVersion: template.layoutVersion ? String(template.layoutVersion) : "",
    printDpi: template.printDpi ? String(template.printDpi) : "",
    config: stringifyConfig(template.config),
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const latestAssets = new Map<TemplateAssetType, (typeof template.assets)[number] | undefined>();
  for (const type of MANAGED_TYPES) {
    latestAssets.set(type, template.assets.find((asset) => asset.type === type));
  }

  useEffect(() => {
    setFormState({
      label: template.label ?? "",
      description: template.description ?? "",
      layoutVersion: template.layoutVersion ? String(template.layoutVersion) : "",
      printDpi: template.printDpi ? String(template.printDpi) : "",
      config: stringifyConfig(template.config),
    });
    setFormError(null);
    setFormSuccess(null);
  }, [template]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const label = formState.label.trim();
    if (!label) {
      setFormError(t("detail.errors.labelRequired"));
      return;
    }

    const description = formState.description.trim();
    const layoutVersionValue = formState.layoutVersion.trim();
    const printDpiValue = formState.printDpi.trim();

    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(formState.config);
    } catch {
      setFormError(t("detail.configInvalid"));
      return;
    }

    let layoutVersion: number | null = null;
    if (layoutVersionValue) {
      const parsed = Number.parseInt(layoutVersionValue, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError(t("detail.errors.layoutVersionInvalid"));
        return;
      }
      layoutVersion = parsed;
    }

    let printDpi: number | null = null;
    if (printDpiValue) {
      const parsed = Number.parseInt(printDpiValue, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError(t("detail.errors.printDpiInvalid"));
        return;
      }
      printDpi = parsed;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description,
          layoutVersion,
          printDpi,
          config: parsedConfig,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.saveFailed"));
      }
      setFormSuccess(t("detail.saveSuccess"));
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("detail.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(t("detail.deleteConfirm", { template: template.label }))) return;
    try {
      setIsDeleting(true);
      await onDelete(template.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("detail.deleteFailed");
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="template-key">{t("create.fields.key")}</Label>
            <Input id="template-key" value={template.key} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-label">{t("create.fields.label")}</Label>
            <Input
              id="template-label"
              value={formState.label}
              onChange={(event) => {
                setFormState((current) => ({ ...current, label: event.target.value }));
                setFormSuccess(null);
              }}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="template-description">{t("create.fields.description")}</Label>
            <Textarea
              id="template-description"
              value={formState.description}
              onChange={(event) => {
                setFormState((current) => ({ ...current, description: event.target.value }));
                setFormSuccess(null);
              }}
              rows={3}
              placeholder={t("create.placeholders.description")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-layout-version">{t("create.fields.layoutVersion")}</Label>
            <Input
              id="template-layout-version"
              type="number"
              min={0}
              value={formState.layoutVersion}
              onChange={(event) => {
                setFormState((current) => ({ ...current, layoutVersion: event.target.value }));
                setFormSuccess(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-print-dpi">{t("create.fields.printDpi")}</Label>
            <Input
              id="template-print-dpi"
              type="number"
              min={0}
              value={formState.printDpi}
              onChange={(event) => {
                setFormState((current) => ({ ...current, printDpi: event.target.value }));
                setFormSuccess(null);
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-config">{t("create.fields.config")}</Label>
          <Textarea
            id="template-config"
            value={formState.config}
            onChange={(event) => {
              setFormState((current) => ({ ...current, config: event.target.value }));
              setFormSuccess(null);
            }}
            rows={12}
            className="font-mono text-xs"
          />
          <p className="text-xs text-slate-500">{t("create.hints.config")}</p>
        </div>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        {formSuccess ? <p className="text-sm text-emerald-600">{formSuccess}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("detail.saving") : t("detail.saveButton")}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.uploadTitle")}</h3>
          <p className="text-xs text-slate-500">{t("detail.uploadHint")}</p>
        </div>
        <TemplateAssetUploader
          templateKey={template.key}
          suggestedVersion={nextAssetVersion(template)}
          className="mt-4"
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("detail.assignedBrands")}</h3>
        {template.brandAssignments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.brandAssignments.map((assignment) => (
              <li key={assignment.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {assignment.brandName}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <AlertCircle className="size-4 text-amber-500" />
            {t("detail.notAssigned")}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("detail.assetsHeading")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MANAGED_TYPES.map((type) => {
            const asset = latestAssets.get(type);
            const missing = !asset;
            const label = t(`assetTypes.${type}` as any);
            return (
              <Card key={type} className={missing ? "border-dashed border-amber-500 bg-amber-50/40 text-amber-700" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                  <CardDescription>
                    {missing
                      ? t("detail.missingAsset")
                      : t("detail.assetMeta", { version: asset?.version ?? 1, updated: formatDate(asset!.updatedAt) })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-col text-xs text-slate-500">
                    <span>
                      {t("detail.fileLabel")}: {asset?.fileName ?? "–"}
                    </span>
                    <span>
                      {t("detail.sizeLabel")}: {formatBytes(asset?.sizeBytes ?? null)}
                    </span>
                  </div>
                  {missing ? <FileWarning className="size-5 text-amber-500" /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {template.assets.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.version")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.type")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.file")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.size")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.updated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {template.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">v{asset.version}</td>
                    <td className="px-4 py-2">{t(`assetTypes.${asset.type}` as any)}</td>
                    <td className="px-4 py-2">{asset.fileName ?? "–"}</td>
                    <td className="px-4 py-2">{formatBytes(asset.sizeBytes)}</td>
                    <td className="px-4 py-2">{formatDate(asset.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("detail.fontsHeading")}</h3>
        {template.fonts.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.fonts.map((font) => (
              <li key={font.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {font.fontFamilyName} • {font.weight} / {font.style.toLowerCase()} / {font.format}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">{t("detail.fontsEmpty")}</p>
        )}
      </section>

      {onDelete ? (
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button variant="destructive" disabled={isDeleting} onClick={handleDelete} className="gap-2">
            <Trash2 className="size-4" />
            {t("detail.deleteButton")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function nextAssetVersion(template: AdminTemplateSummary) {
  if (template.assets.length === 0) return 1;
  return Math.max(...template.assets.map((asset) => asset.version)) + 1;
}

function formatBytes(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("de-AT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringifyConfig(value: unknown) {
  try {
    if (value === null || value === undefined) {
      return "{}";
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}
