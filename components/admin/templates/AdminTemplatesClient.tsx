"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminFontFamily, AdminTemplateSummary } from "@/lib/admin/templates-data";
import { TemplateAssetType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TemplateDetailContent from "./TemplateDetailContent";
import FontVariantUploader from "./FontVariantUploader";

type Props = {
  templates: AdminTemplateSummary[];
  fontFamilies: AdminFontFamily[];
};

const MANAGED_TYPES: TemplateAssetType[] = [
  TemplateAssetType.PDF,
  TemplateAssetType.PREVIEW_FRONT,
  TemplateAssetType.PREVIEW_BACK,
  TemplateAssetType.CONFIG,
];

export default function AdminTemplatesClient({ templates, fontFamilies }: Props) {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const router = useRouter();

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [activeTemplateId, templates],
  );

  const templateTable = (
    <Card>
      <CardHeader className="border-b border-slate-200 bg-slate-50/60">
        <CardTitle className="text-lg">Templates</CardTitle>
        <CardDescription>
          Übersicht über alle verfügbaren Vorlagen. Öffne die Detailansicht, um Assets zu verwalten oder neue Versionen
          hochzuladen.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 py-0">
        {templates.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            Noch keine Templates angelegt. Lade deine erste Vorlage über die Detailansicht hoch.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Template</th>
                <th className="px-6 py-3 text-left font-semibold">Brands</th>
                <th className="px-6 py-3 text-left font-semibold">Asset-Status</th>
                <th className="px-6 py-3 text-left font-semibold">Aktualisiert</th>
                <th className="px-6 py-3 text-right font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {templates.map((template) => {
                const assetStatus = computeAssetStatus(template);
                return (
                  <tr key={template.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{template.label}</div>
                      <div className="text-xs text-slate-500">{template.key}</div>
                    </td>
                    <td className="px-6 py-4">
                      {template.brandAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          {template.brandAssignments.map((brand) => (
                            <span key={brand.id} className="rounded-full bg-slate-100 px-2 py-0.5">
                              {brand.brandName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600">Nicht zugewiesen</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className={assetStatus.missing > 0 ? "text-amber-600" : "text-emerald-600"}>
                        {assetStatus.message}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{formatDate(template.updatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => setActiveTemplateId(template.id)}
                        className="bg-slate-900 text-white hover:bg-slate-800"
                      >
                        Verwalten
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );

  const fontLibrary = (
    <Card>
      <CardHeader className="border-b border-slate-200 bg-slate-50/60">
        <CardTitle className="text-lg">Font Bibliothek</CardTitle>
        <CardDescription>
          Hinterlegte Schriftfamilien für PDF-Rendering und Preview. Ergänze Variationen über den Uploader.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 py-6">
        {fontFamilies.length > 0 ? (
          <div className="space-y-4">
            {fontFamilies.map((family) => (
              <div key={family.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{family.name}</h4>
                    <p className="text-xs text-slate-500">Slug: {family.slug}</p>
                  </div>
                </div>
                {family.variants.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {family.variants.map((variant) => (
                      <li key={variant.id} className="rounded-full bg-slate-100 px-3 py-1">
                        {variant.weight} / {variant.style.toLowerCase()} / {variant.format}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">Noch keine Varianten vorhanden.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Noch keine Fonts hochgeladen.</p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
          <h3 className="text-sm font-semibold text-slate-900">Neue Font-Variante hochladen</h3>
          <p className="text-xs text-slate-500">
            Unterstützt TTF, OTF, WOFF und WOFF2. Fonts werden im privaten Supabase Storage abgelegt.
          </p>
          <FontVariantUploader
            families={fontFamilies.map((family) => ({ id: family.id, name: family.name, slug: family.slug }))}
            className="mt-4"
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Vorlagen &amp; Fonts</h1>
        <p className="text-sm text-slate-500">
          Pflege hier die Design-Grundlagen. Änderungen wirken sich auf neue Bestellungen aus – bestehende Aufträge bleiben
          unverändert.
        </p>
      </header>

      {templateTable}
      {fontLibrary}

      <Dialog open={Boolean(activeTemplate)} onOpenChange={(open) => (!open ? setActiveTemplateId(null) : null)}>
        <DialogContent className="max-w-4xl">
          {activeTemplate ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Template verwalten</DialogTitle>
                <DialogDescription>{activeTemplate.label}</DialogDescription>
              </DialogHeader>
              <TemplateDetailContent
                template={activeTemplate}
                onDelete={async (templateId) => {
                  const response = await fetch(`/api/admin/templates/${templateId}`, { method: "DELETE" });
                  if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload?.error ?? "Löschen fehlgeschlagen");
                  }
                  setActiveTemplateId(null);
                  router.refresh();
                }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function computeAssetStatus(template: AdminTemplateSummary) {
  const latestByType = new Map<TemplateAssetType, boolean>();
  for (const type of MANAGED_TYPES) {
    latestByType.set(type, false);
  }
  for (const asset of template.assets) {
    if (latestByType.has(asset.type) && !latestByType.get(asset.type)) {
      latestByType.set(asset.type, true);
    }
  }
  const missing = Array.from(latestByType.entries())
    .filter(([, present]) => !present)
    .map(([type]) => type);

  if (missing.length === 0) {
    return { missing: 0, message: "Alle Pflicht-Assets vorhanden" };
  }

  return {
    missing: missing.length,
    message: `${missing.length} fehlend (${missing.map((type) => ASSET_TYPE_LABELS[type] ?? type).join(", ")})`,
  };
}

const ASSET_TYPE_LABELS: Record<TemplateAssetType, string> = {
  [TemplateAssetType.PDF]: "PDF",
  [TemplateAssetType.PREVIEW_FRONT]: "Preview Front",
  [TemplateAssetType.PREVIEW_BACK]: "Preview Back",
  [TemplateAssetType.CONFIG]: "Config",
  [TemplateAssetType.OTHER]: "Weitere",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
