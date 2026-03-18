"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { TemplateAssetType } from "@prisma/client";

import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { hasInlineDesignConfig } from "@/lib/template-design";
import { TemplatesTable } from "./TemplatesTable";
import { formatDateTime } from "@/lib/formatDateTime";

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
  const [entries, setEntries] = useState<AdminTemplateSummary[]>(templates);
  const router = useRouter();
  const t = useTranslations("admin.templates");
  const { locale } = useLocale();

  useEffect(() => {
    setEntries(templates);
  }, [templates]);

  const tableRows = useMemo(() => {
    return entries.map((template) => {
      const inlineDesign = hasInlineDesignConfig(template.config);
      const assetStatus = computeAssetStatus(
        template,
        inlineDesign,
        (type) => t(`assetTypes.${type}` as any),
        (count, list) => t("assetStatus.missingPlural", { count, list }),
        t("assetStatus.allPresent"),
      );

      return {
        id: template.id,
        label: template.label,
        key: template.key,
        brandNames: template.brandAssignments.map((brand) => brand.brandName),
        assetStatus: {
          message: assetStatus.message,
          tone: assetStatus.missing > 0 ? "warning" : "ok",
        } as const,
        updatedAtLabel: formatDateTime(template.updatedAt, locale, { dateStyle: "medium" }),
        updatedAtValue: new Date(template.updatedAt).getTime(),
        brandCount: template.brandAssignments.length,
      };
    });
  }, [entries, t, locale]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button
          onClick={() => router.push("/admin/templates/new")}
          className="inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          {t("actions.add")}
        </Button>
      </header>

      <TemplatesTable
        data={tableRows}
        searchPlaceholder={t("table.searchPlaceholder")}
        emptyState={t("table.empty")}
        noResults={t("table.noResults")}
        paginationLabel={({ from, to, total }) => t("table.pagination.label", { from, to, total })}
        previousLabel={t("table.pagination.previous")}
        nextLabel={t("table.pagination.next")}
        resetLabel={t("table.pagination.reset")}
        columns={{
          template: t("table.headers.template"),
          brands: t("table.headers.brands"),
          assetStatus: t("table.headers.assetStatus"),
          updated: t("table.headers.updated"),
        }}
        unassignedLabel={t("table.unassigned")}
        onManage={(id) => router.push(`/admin/templates/${id}`)}
      />
    </div>
  );
}

function computeAssetStatus(
  template: AdminTemplateSummary,
  hasInlineDesign: boolean,
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
  if (hasInlineDesign) {
    latestByType.set(TemplateAssetType.CONFIG, true);
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
