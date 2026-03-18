"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

import { BrandsTable } from "./BrandsTable";
import { createBrandColumns } from "./BrandColumns";

type Props = {
  brands: AdminBrandSummary[];
};

export default function AdminBrandsClient({ brands }: Props) {
  const t = useTranslations("admin.brands");
  const router = useRouter();
  const [rows, setRows] = useState(brands);

  const columns = useMemo(() => createBrandColumns(t), [t]);

  useEffect(() => {
    setRows(brands);
  }, [brands]);

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
      />
    </div>
  );
}
