"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import type { AdminFontFamily } from "@/lib/admin/templates-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { FontsTable } from "./FontsTable";
import { FontCreateDialog } from "./FontCreateDialog";
import { FontDetailDialog } from "./FontDetailDialog";
import { formatDateTime } from "@/lib/formatDateTime";

type Props = {
  fontFamilies: AdminFontFamily[];
  autoOpen?: boolean;
};

type DialogState = { mode: "create" } | { mode: "view"; familyId: string } | null;

export default function AdminFontsClient({ fontFamilies, autoOpen }: Props) {
  const t = useTranslations("admin.fonts");
  const { locale } = useLocale();
  const [families, setFamilies] = useState<AdminFontFamily[]>(fontFamilies);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setFamilies(fontFamilies);
  }, [fontFamilies]);

  useEffect(() => {
    if (autoOpen) setDialogState({ mode: "create" });
  }, [autoOpen]);

  const activeFamily = useMemo(() => {
    if (dialogState?.mode !== "view") return null;
    return families.find((family) => family.id === dialogState.familyId) ?? null;
  }, [dialogState, families]);

  const tableRows = useMemo(() => {
    return families.map((family) => {
      const variantSummary =
        family.variants.length === 0
          ? t("table.variantSummary.empty")
          : family.variants
              .slice(0, 3)
              .map((variant) => `${variant.weight}${variant.style === "ITALIC" ? "i" : ""} / ${variant.format}`)
              .join(", ") + (family.variants.length > 3 ? "…" : "");

      return {
        id: family.id,
        name: family.name,
        slug: family.slug,
        variantCount: family.variants.length,
        variantSummary,
        updatedAtLabel: formatDateTime(family.updatedAt, locale, { dateStyle: "medium" }),
        updatedAtValue: new Date(family.updatedAt).getTime(),
      };
    });
  }, [families, t, locale]);

  const handleFamilyCreated = (family: AdminFontFamily) => {
    setFamilies((current) => {
      const next = [...current, family];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setFeedback({ type: "success", message: t("toast.created", { name: family.name }) });
    setDialogState({ mode: "view", familyId: family.id });
  };

  const handleFamilyUpdated = (family: AdminFontFamily) => {
    setFamilies((current) => current.map((item) => (item.id === family.id ? family : item)));
    setFeedback({ type: "success", message: t("toast.updated", { name: family.name }) });
    setDialogState({ mode: "view", familyId: family.id });
  };

  const handleFamilyDeleted = (familyId: string) => {
    setFamilies((current) => current.filter((family) => family.id !== familyId));
    setFeedback({ type: "success", message: t("toast.deleted") });
    setDialogState(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button
          onClick={() => setDialogState({ mode: "create" })}
          className="inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("actions.newFamily")}
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

      <FontsTable
        data={tableRows}
        searchPlaceholder={t("table.searchPlaceholder")}
        emptyState={t("table.empty")}
        noResults={t("table.noResults")}
        paginationLabel={({ from, to, total }) => t("table.pagination.label", { from, to, total })}
        previousLabel={t("table.pagination.previous")}
        nextLabel={t("table.pagination.next")}
        resetLabel={t("table.pagination.reset")}
        columns={{
          family: t("table.headers.family"),
          slug: t("table.headers.slug"),
          variants: t("table.headers.variants"),
          updated: t("table.headers.updated"),
        }}
        onManage={(id) => setDialogState({ mode: "view", familyId: id })}
      />

      <FontDetailDialog
        family={activeFamily}
        open={dialogState?.mode === "view" && Boolean(activeFamily)}
        onOpenChange={(open) => (!open ? setDialogState(null) : null)}
        onFamilyUpdated={handleFamilyUpdated}
        onFamilyDeleted={handleFamilyDeleted}
      />

      <FontCreateDialog
        open={dialogState?.mode === "create"}
        onOpenChange={(open) => (!open ? setDialogState(null) : null)}
        onCreated={handleFamilyCreated}
      />
    </div>
  );
}
