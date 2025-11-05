"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateAssetType } from "@prisma/client";
import { AlertCircle, FileWarning, Trash2 } from "lucide-react";

import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const t = useTranslations("admin.templates");
  const [configDraft, setConfigDraft] = useState(() => stringifyConfig(template.config));
  const [configError, setConfigError] = useState<string | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const latestAssets = new Map<TemplateAssetType, (typeof template.assets)[number] | undefined>();
  for (const type of MANAGED_TYPES) {
    latestAssets.set(type, template.assets.find((asset) => asset.type === type));
  }

  useEffect(() => {
    setConfigDraft(stringifyConfig(template.config));
    setConfigError(null);
    setConfigMessage(null);
  }, [template.config]);

  useEffect(() => {
    if (!configMessage) return;
    const timeout = setTimeout(() => setConfigMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [configMessage]);

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

  const handleConfigSave = async () => {
    setConfigError(null);
    setConfigMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(configDraft);
    } catch {
      setConfigError(t("detail.configInvalid"));
      return;
    }
    setIsSavingConfig(true);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.configSaveFailed"));
      }
      setConfigMessage(t("detail.configSaved"));
      router.refresh();
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : t("detail.configSaveFailed"));
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          {template.label} <span className="text-sm font-normal text-slate-500">({template.key})</span>
        </h2>
        <p className="text-sm text-slate-500">{template.description || t("detail.noDescription")}</p>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          <div>
            <dt className="font-medium uppercase tracking-wide text-slate-400">{t("detail.layoutVersion")}</dt>
            <dd>{template.layoutVersion ?? "–"}</dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-slate-400">{t("detail.printDpi")}</dt>
            <dd>{template.printDpi ?? "–"}</dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide text-slate-400">{t("detail.updatedAt")}</dt>
            <dd>{formatDate(template.updatedAt)}</dd>
          </div>
        </dl>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("detail.configHeading")}</h3>
            <p className="text-xs text-slate-500">{t("detail.configDescription")}</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {configMessage ? <span className="text-xs text-emerald-600">{configMessage}</span> : null}
            <Button size="sm" variant="secondary" onClick={handleConfigSave} disabled={isSavingConfig}>
              {isSavingConfig ? t("detail.configSaving") : t("detail.configSave")}
            </Button>
          </div>
        </div>
        <Textarea
          value={configDraft}
          onChange={(event) => {
            setConfigDraft(event.target.value);
            if (configError) setConfigError(null);
          }}
          rows={12}
          className="font-mono text-xs"
        />
        {configError ? <p className="text-xs text-red-600">{configError}</p> : null}
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

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <Label className="text-sm font-semibold text-slate-900">{t("detail.uploadTitle")}</Label>
          <p className="text-xs text-slate-500">{t("detail.uploadHint")}</p>
          <TemplateAssetUploader
            templateKey={template.key}
            suggestedVersion={nextAssetVersion(template)}
            className="mt-4"
          />
        </div>
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
