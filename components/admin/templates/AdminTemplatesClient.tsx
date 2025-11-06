"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { TemplateAssetType } from "@prisma/client";

import { useTranslations } from "@/components/providers/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import TemplateDetailContent from "./TemplateDetailContent";
import { hasInlineDesignConfig } from "@/lib/template-design";
import { TemplatesTable } from "./templates-table";
import TemplateCreateForm from "./TemplateCreateForm";

type Props = {
  templates: AdminTemplateSummary[];
};

const MANAGED_TYPES: TemplateAssetType[] = [
  TemplateAssetType.PDF,
  TemplateAssetType.PREVIEW_FRONT,
  TemplateAssetType.PREVIEW_BACK,
  TemplateAssetType.CONFIG,
];

type SheetState =
  | { mode: "view"; templateId: string }
  | { mode: "create" }
  | null;

export default function AdminTemplatesClient({ templates }: Props) {
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [entries, setEntries] = useState<AdminTemplateSummary[]>(templates);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();
  const t = useTranslations("admin.templates");

  useEffect(() => {
    setEntries(templates);
  }, [templates]);

  const activeTemplate = useMemo(() => {
    if (sheetState?.mode !== "view") return null;
    return entries.find((template) => template.id === sheetState.templateId) ?? null;
  }, [sheetState, entries]);

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
        updatedAtLabel: formatDate(template.updatedAt),
        updatedAtValue: new Date(template.updatedAt).getTime(),
        brandCount: template.brandAssignments.length,
      };
    });
  }, [entries, t]);

  const deleteTemplates = async (ids: string[]) => {
    if (ids.length === 0) return false;
    setIsDeleting(true);
    setFeedback(null);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? t("table.bulkDelete.error"));
        }
      }

      setEntries((current) => current.filter((template) => !ids.includes(template.id)));
      setSheetState((current) =>
        current?.mode === "view" && ids.includes(current.templateId) ? null : current,
      );
      setFeedback({ type: "success", message: t("table.bulkDelete.success", { count: ids.length }) });
      router.refresh();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("table.bulkDelete.error");
      setFeedback({ type: "error", message });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTemplateCreated = (template: AdminTemplateSummary) => {
    setEntries((current) => {
      const next = [...current, template];
      return next.sort((a, b) => a.label.localeCompare(b.label));
    });
    setSheetState({ mode: "view", templateId: template.id });
    setFeedback({ type: "success", message: t("create.success", { label: template.label }) });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button
          onClick={() => setSheetState({ mode: "create" })}
          className="inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          {t("actions.add")}
        </Button>
      </header>

      {feedback ? (
        <div
          className={
            feedback.type === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <TemplatesTable
        data={tableRows}
        searchPlaceholder={t("table.searchPlaceholder")}
        emptyState={t("table.empty")}
        noResults={t("table.noResults")}
        paginationLabel={({ from, to, total }) => t("table.pagination.label", { from, to, total })}
        previousLabel={t("table.pagination.previous")}
        nextLabel={t("table.pagination.next")}
        resetLabel={t("table.pagination.reset")}
        deleteLabel={t("table.bulkDelete.action")}
        selectionLabel={(count) => t("table.bulkDelete.selection", { count })}
        manageLabel={t("table.manage")}
        columns={{
          template: t("table.headers.template"),
          brands: t("table.headers.brands"),
          assetStatus: t("table.headers.assetStatus"),
          updated: t("table.headers.updated"),
          actions: t("table.headers.actions"),
        }}
        unassignedLabel={t("table.unassigned")}
        onManage={(id) => setSheetState({ mode: "view", templateId: id })}
        onDeleteSelected={deleteTemplates}
        isDeleting={isDeleting}
      />

      <Sheet open={Boolean(sheetState)} onOpenChange={(open) => (!open ? setSheetState(null) : null)}>
        <SheetContent className="flex h-full max-w-4xl flex-col p-0">
          {sheetState?.mode === "view" && activeTemplate ? (
            <>
              <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
                <SheetTitle>{activeTemplate.label}</SheetTitle>
                <SheetDescription>
                  {activeTemplate.description || t("detail.noDescription")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <TemplateDetailContent
                  template={activeTemplate}
                  onDelete={async (templateId) => {
                    const success = await deleteTemplates([templateId]);
                    if (!success) {
                      throw new Error(t("detail.deleteFailed"));
                    }
                    setSheetState(null);
                  }}
                />
              </div>
            </>
          ) : null}
          {sheetState?.mode === "create" ? (
            <>
              <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
                <SheetTitle>{t("create.title")}</SheetTitle>
                <SheetDescription>{t("create.description")}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <TemplateCreateForm
                  onCreated={(template) => handleTemplateCreated(template)}
                  onCancel={() => setSheetState(null)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
