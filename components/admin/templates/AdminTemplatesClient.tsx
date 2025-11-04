"use client";

import { useMemo } from "react";
import type { AdminFontFamily, AdminTemplateSummary } from "@/lib/admin/templates-data";
import { TemplateAssetType } from "@prisma/client";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import FontVariantUploader from "./FontVariantUploader";
import TemplateAssetUploader from "./TemplateAssetUploader";

type Props = {
  templates: AdminTemplateSummary[];
  fontFamilies: AdminFontFamily[];
};

export default function AdminTemplatesClient({ templates, fontFamilies }: Props) {
  const templateCards = useMemo(() => {
    if (templates.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Keine Templates</CardTitle>
            <CardDescription>Leg dein erstes Template an, indem du Assets und Konfigurationen hochlädst.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Über den Uploader kannst du PDF-Master, Preview-Bilder oder Config-Dateien hochladen. Danach kannst du das
              Template in den Bestellungen verwenden.
            </p>
          </CardContent>
        </Card>
      );
    }

    return templates.map((template) => {
      const nextVersion =
        template.assets.length > 0 ? Math.max(...template.assets.map((asset) => asset.version)) + 1 : 1;

      return (
        <Card key={template.id} className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/60">
            <CardTitle className="text-lg flex items-center justify-between gap-3">
              <span>
                {template.label} <span className="text-sm font-normal text-slate-500">({template.key})</span>
              </span>
              {template.layoutVersion ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                  Layout v{template.layoutVersion}
                </span>
              ) : null}
            </CardTitle>
            <CardDescription>
              {template.description || "Assets verwalten und neue Versionen hochladen. Änderungen wirken sich auf neue Bestellungen aus."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Assets</h3>
              {template.assets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-4">Version</th>
                        <th className="pb-2 pr-4">Typ</th>
                        <th className="pb-2 pr-4">Datei</th>
                        <th className="pb-2 pr-4">Größe</th>
                        <th className="pb-2 pr-4">Geändert</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {template.assets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-slate-50">
                          <td className="py-2 pr-4 font-medium text-slate-900">v{asset.version}</td>
                          <td className="py-2 pr-4">{humanizeAssetType(asset.type)}</td>
                          <td className="py-2 pr-4">{asset.fileName || "–"}</td>
                          <td className="py-2 pr-4">{formatBytes(asset.sizeBytes)}</td>
                          <td className="py-2 pr-4">{formatDate(asset.updatedAt)}</td>
                          <td className="py-2 text-right">
                            <DownloadButton storageKey={asset.storageKey} disabled />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Noch keine Assets hinterlegt.</p>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
                <h4 className="text-sm font-semibold text-slate-800">Neues Asset hochladen</h4>
                <p className="text-xs text-slate-500">
                  Für Revisionen einfach die Version hochzählen. PDF und Preview sollten dieselben Maße verwenden, damit die
                  mm-Konfiguration exakt passt.
                </p>
                <TemplateAssetUploader templateKey={template.key} suggestedVersion={nextVersion} className="mt-4" />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Zugeordnete Fonts</h3>
              {template.fonts.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {template.fonts.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{entry.fontFamilyName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {entry.weight} / {entry.style.toLowerCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{entry.format}</span>
                      {entry.usage ? <span className="text-xs text-slate-500">({entry.usage})</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Keine Fonts verknüpft.</p>
              )}
            </section>
          </CardContent>
        </Card>
      );
    });
  }, [templates]);

  const fontCard = (
    <Card>
      <CardHeader className="border-b border-slate-200 bg-slate-50/60">
        <CardTitle className="text-lg">Font Bibliothek</CardTitle>
        <CardDescription>
          Lade neue Varianten hoch oder ordne bestehende einem Template zu. Fonts werden serverseitig eingebunden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 py-6">
        {fontFamilies.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Bestehende Familien</h3>
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

      <div className="space-y-6">{templateCards}</div>

      {fontCard}
    </div>
  );
}

type DownloadButtonProps = {
  storageKey: string;
  disabled?: boolean;
};

function DownloadButton({ storageKey, disabled }: DownloadButtonProps) {
  return (
    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" disabled={disabled}>
      <Download className="size-4" />
      <span className="sr-only">Download {storageKey}</span>
    </Button>
  );
}

function humanizeAssetType(type: TemplateAssetType) {
  switch (type) {
    case TemplateAssetType.PDF:
      return "PDF";
    case TemplateAssetType.PREVIEW_FRONT:
      return "Preview Front";
    case TemplateAssetType.PREVIEW_BACK:
      return "Preview Back";
    case TemplateAssetType.CONFIG:
      return "Config";
    default:
      return type;
  }
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
  const date = new Date(iso);
  return date.toLocaleDateString("de-AT", { year: "numeric", month: "short", day: "numeric" });
}
