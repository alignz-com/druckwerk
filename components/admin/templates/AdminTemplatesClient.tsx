"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
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
import { useTranslations } from "@/components/providers/locale-provider";

type Props = {
  templates: AdminTemplateSummary[];
};

const MANAGED_TYPES: TemplateAssetType[] = [
  TemplateAssetType.PDF,
  TemplateAssetType.PREVIEW_FRONT,
  TemplateAssetType.PREVIEW_BACK,
  TemplateAssetType.CONFIG,
];

export default function AdminTemplatesClient({ templates }: Props) {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("admin.templates");

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [activeTemplateId, templates],
  );

  const templateTable = (
    <Card>
      <CardHeader className="border-b border-slate-200 bg-slate-50/60">
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 py-0">
        {templates.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">{t("table.empty")}</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">{t("table.headers.template")}</th>
                <th className="px-6 py-3 text-left font-semibold">{t("table.headers.brands")}</th>
                <th className="px-6 py-3 text-left font-semibold">{t("table.headers.assetStatus")}</th>
                <th className="px-6 py-3 text-left font-semibold">{t("table.headers.updated")}</th>
                <th className="px-6 py-3 text-right font-semibold">{t("table.headers.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {templates.map((template) => {
                const assetStatus = computeAssetStatus(
                  template,
                  (type) => t(`assetTypes.${type}` as any),
                  (count, list) => t("assetStatus.missingPlural", { count, list }),
                  t("assetStatus.allPresent"),
                );
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
                        <span className="text-xs text-amber-600">{t("table.unassigned")}</span>
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
                        {t("table.manage")}
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("description")}</p>
      </header>
      {templateTable}

      <Dialog open={Boolean(activeTemplate)} onOpenChange={(open) => (!open ? setActiveTemplateId(null) : null)}>
        <DialogContent className="max-w-4xl">
          {activeTemplate ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>{activeTemplate.label}</DialogDescription>
              </DialogHeader>
              <TemplateDetailContent
                template={activeTemplate}
                onDelete={async (templateId) => {
                  const response = await fetch(`/api/admin/templates/${templateId}`, { method: "DELETE" });
                  if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload?.error ?? t("detail.deleteFailed"));
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

function computeAssetStatus(
  template: AdminTemplateSummary,
  getLabel: (type: TemplateAssetType) => string,
  missingMessage: (count: number, list: string) => string,
  allPresentMessage: string,
) {
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
    return { missing: 0, message: allPresentMessage };
  }

  const list = missing.map((type) => getLabel(type)).join(", ");
  return {
    missing: missing.length,
    message: missingMessage(missing.length, list),
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
