"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

      <Card className="border-slate-200 shadow-none">
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="text-lg">{t("table.title")}</CardTitle>
          <CardDescription>{t("table.description")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
