"use client";

import { useState } from "react";
import { TemplateAssetType } from "@prisma/client";
import { AlertCircle, FileWarning, Trash2 } from "lucide-react";

import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import TemplateAssetUploader from "./TemplateAssetUploader";

const ASSET_TYPE_LABELS: Record<TemplateAssetType, string> = {
  [TemplateAssetType.PDF]: "PDF Master",
  [TemplateAssetType.PREVIEW_FRONT]: "Preview Front",
  [TemplateAssetType.PREVIEW_BACK]: "Preview Back",
  [TemplateAssetType.CONFIG]: "Config JSON",
  [TemplateAssetType.OTHER]: "Weitere Assets",
};

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
  const latestAssets = new Map<TemplateAssetType, typeof template.assets[number] | undefined>();

  for (const type of MANAGED_TYPES) {
    latestAssets.set(
      type,
      template.assets.find((asset) => asset.type === type),
    );
  }

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Template "${template.label}" wirklich löschen?`)) return;
    try {
      setIsDeleting(true);
      await onDelete(template.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {template.label} <span className="text-sm font-normal text-slate-500">({template.key})</span>
          </h2>
          <p className="text-sm text-slate-500">{template.description || "Keine Beschreibung hinterlegt."}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Layout-Version</dt>
              <dd>{template.layoutVersion ?? "–"}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Print DPI</dt>
              <dd>{template.printDpi ?? "–"}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-slate-400">Zuletzt geändert</dt>
              <dd>{formatDate(template.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        {onDelete ? (
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
            Template löschen
          </Button>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Zugewiesene Brands</h3>
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
            Noch keinem Brand zugewiesen.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Assets Übersicht</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MANAGED_TYPES.map((type) => {
            const asset = latestAssets.get(type);
            const missing = !asset;
            return (
              <Card key={type} className={missing ? "border-dashed border-amber-500 bg-amber-50/40 text-amber-700" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{ASSET_TYPE_LABELS[type]}</CardTitle>
                  <CardDescription>
                    {missing ? "Noch kein Asset vorhanden." : `Version v${asset?.version ?? 1} • ${formatDate(asset!.updatedAt)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-col text-xs text-slate-500">
                    <span>Datei: {asset?.fileName ?? "–"}</span>
                    <span>Größe: {formatBytes(asset?.sizeBytes ?? null)}</span>
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
                  <th className="px-4 py-2 text-left font-semibold">Version</th>
                  <th className="px-4 py-2 text-left font-semibold">Typ</th>
                  <th className="px-4 py-2 text-left font-semibold">Datei</th>
                  <th className="px-4 py-2 text-left font-semibold">Größe</th>
                  <th className="px-4 py-2 text-left font-semibold">Geändert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {template.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">v{asset.version}</td>
                    <td className="px-4 py-2">{ASSET_TYPE_LABELS[asset.type] ?? asset.type}</td>
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
          <Label className="text-sm font-semibold text-slate-900">Neues Asset hochladen</Label>
          <p className="text-xs text-slate-500">
            Bitte identische Maße für PDF und Preview verwenden. Versionen ermöglichen Rollback der Produktion.
          </p>
          <TemplateAssetUploader templateKey={template.key} suggestedVersion={nextAssetVersion(template)} className="mt-4" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Fonts</h3>
        {template.fonts.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.fonts.map((font) => (
              <li key={font.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {font.fontFamilyName} • {font.weight} / {font.style.toLowerCase()} / {font.format}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Keine Fonts verknüpft.</p>
        )}
      </section>
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
