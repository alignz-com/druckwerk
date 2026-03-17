"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

import { BrandsTable } from "./brands-table";
import { createBrandColumns } from "./columns";

type Props = {
  brands: AdminBrandSummary[];
};

export default function AdminBrandsClient({ brands }: Props) {
  const t = useTranslations("admin.brands");
  const router = useRouter();
  const [rows, setRows] = useState(brands);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const columns = useMemo(() => createBrandColumns(t), [t]);

  useEffect(() => {
    setRows(brands);
  }, [brands]);

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
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button
          onClick={() => router.push("/admin/brands/new")}
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
    </div>
  );
}
