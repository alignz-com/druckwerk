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
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/admin/brands/new">{t("actions.newBrand")}</Link>
        </Button>
      </header>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t("table.title")}</h2>
          <p className="text-sm text-slate-500">{t("table.description")}</p>
        </div>
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
      </section>
    </div>
  );
}
