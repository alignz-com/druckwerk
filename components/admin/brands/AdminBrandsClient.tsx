"use client";

import { useMemo } from "react";
import Link from "next/link";

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

  const columns = useMemo(() => createBrandColumns(t), [t]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/admin/brands/new">{t("actions.newBrand")}</Link>
        </Button>
      </header>

      <BrandsTable
        columns={columns}
        data={brands}
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
