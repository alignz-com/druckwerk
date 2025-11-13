"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

import { BrandsTable } from "./brands-table";
import { createBrandColumns } from "./columns";
import BrandCreateSheet from "./BrandCreateSheet";
import BrandDetailSheet from "./BrandDetailSheet";

type Props = {
  brands: AdminBrandSummary[];
};

type SheetState = { mode: "view"; brandId: string } | { mode: "create" } | null;

export default function AdminBrandsClient({ brands }: Props) {
  const t = useTranslations("admin.brands");
  const [rows, setRows] = useState(brands);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>(null);

  const columns = useMemo(() => createBrandColumns(t, (id) => setSheetState({ mode: "view", brandId: id })), [t]);

  useEffect(() => {
    setRows(brands);
  }, [brands]);

  const activeBrand = useMemo(() => {
    if (sheetState?.mode !== "view") return null;
    return rows.find((brand) => brand.id === sheetState.brandId) ?? null;
  }, [sheetState, rows]);

  const handleBrandCreated = (brand: AdminBrandSummary) => {
    setRows((current) => {
      const next = [...current, brand];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setSheetState({ mode: "view", brandId: brand.id });
    setFeedback({ type: "success", message: t("toast.created", { name: brand.name }) });
  };

  const handleBrandUpdated = (brand: AdminBrandSummary) => {
    setRows((current) => current.map((item) => (item.id === brand.id ? brand : item)));
    setSheetState({ mode: "view", brandId: brand.id });
    setFeedback({ type: "success", message: t("toast.updated", { name: brand.name }) });
  };

  const handleBrandDeleted = (brandId: string) => {
    setRows((current) => current.filter((brand) => brand.id !== brandId));
    setSheetState(null);
    setFeedback({ type: "success", message: t("toast.deleted") });
  };

  const handleDeleteSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    setIsDeleting(true);
    setFeedback(null);

    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/brands/${id}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? t("table.bulkDelete.error"));
        }
      }

      setRows((current) => current.filter((brand) => !ids.includes(brand.id)));
      setFeedback({ type: "success", message: t("table.bulkDelete.success", { count: ids.length }) });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("table.bulkDelete.error");
      setFeedback({ type: "error", message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button
          onClick={() => setSheetState({ mode: "create" })}
          className="inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("actions.newBrand")}
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

      <BrandsTable
        columns={columns}
        data={rows}
        searchPlaceholder={t("table.searchPlaceholder")}
        emptyState={t("table.empty")}
        noResults={t("table.noResults")}
        paginationLabel={({ from, to, total }) =>
          t("table.pagination.label", { from, to, total })
        }
        previousLabel={t("table.pagination.previous")}
        nextLabel={t("table.pagination.next")}
        resetLabel={t("table.pagination.reset")}
        deleteLabel={t("table.bulkDelete.action")}
        selectionLabel={(count) => t("table.bulkDelete.selection", { count })}
        onDeleteSelected={handleDeleteSelected}
        isDeleting={isDeleting}
      />

      <BrandDetailSheet
        brand={activeBrand}
        open={sheetState?.mode === "view" && Boolean(activeBrand)}
        onOpenChange={(open) => (!open ? setSheetState(null) : null)}
        onBrandUpdated={handleBrandUpdated}
        onBrandDeleted={handleBrandDeleted}
      />

      <BrandCreateSheet
        open={sheetState?.mode === "create"}
        onOpenChange={(open) => (!open ? setSheetState(null) : null)}
        onBrandCreated={handleBrandCreated}
      />
    </div>
  );
}
