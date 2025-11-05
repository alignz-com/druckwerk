import Link from "next/link";
import { Building2, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type TranslationFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type BrandColumn<TData> = {
  id: string;
  title: string;
  align?: "left" | "right";
  enableSorting?: boolean;
  renderCell: (row: TData) => ReactNode;
  sortAccessor?: (row: TData) => string | number;
};

export function createBrandColumns(t: TranslationFn, onManage?: (id: string) => void): BrandColumn<AdminBrandSummary>[] {
  return [
    {
      id: "name",
      title: t("table.headers.brand"),
      enableSorting: true,
      sortAccessor: (row) => row.name.toLowerCase(),
      renderCell: (row) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500">{row.slug}</div>
        </div>
      ),
    },
    {
      id: "contact",
      title: t("table.headers.contact"),
      enableSorting: false,
      renderCell: (row) => (
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="h-3.5 w-3.5" />
            <span>{row.contactName ?? t("table.noContact")}</span>
          </div>
          {row.contactEmail ? (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span>{row.contactEmail}</span>
            </div>
          ) : null}
          {row.contactPhone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              <span>{row.contactPhone}</span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "templateCount",
      title: t("table.headers.templates"),
      align: "right",
      enableSorting: true,
      sortAccessor: (row) => row.templateCount,
      renderCell: (row) => <Badge variant="secondary">{row.templateCount}</Badge>,
    },
    {
      id: "addresses",
      title: t("table.headers.addresses"),
      align: "right",
      enableSorting: true,
      sortAccessor: (row) => row.addresses.length,
      renderCell: (row) => <Badge variant="outline">{row.addresses.length}</Badge>,
    },
    {
      id: "actions",
      title: t("table.headers.actions"),
      align: "right",
      enableSorting: false,
      renderCell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => (onManage ? onManage(row.id) : undefined)}
            asChild={!onManage}
          >
            {onManage ? <span>{t("actions.manage")}</span> : <Link href={`/admin/brands/${row.id}`}>{t("actions.manage")}</Link>}
          </Button>
        </div>
      ),
    },
  ];
}
