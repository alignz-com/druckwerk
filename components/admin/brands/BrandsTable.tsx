"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dataTableContainerClass,
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";

import { DataTableColumnHeader } from "@/components/admin/shared/DataTableColumnHeader";
import type { BrandColumn } from "./BrandColumns";

const PAGE_SIZE = 10;

type PaginationFormatter = (args: { from: number; to: number; total: number }) => string;

type BrandsTableProps = {
  columns: BrandColumn<AdminBrandSummary>[];
  data: AdminBrandSummary[];
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  paginationLabel: PaginationFormatter;
  previousLabel: string;
  nextLabel: string;
  resetLabel: string;
};

export function BrandsTable({
  columns,
  data,
  searchPlaceholder,
  emptyState,
  noResults,
  paginationLabel,
  previousLabel,
  nextLabel,
  resetLabel,
}: BrandsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredData = useMemo(() => {
    if (!normalizedSearch) {
      return data;
    }

    return data.filter((brand) => {
      const haystack = [
        brand.name,
        brand.slug,
        brand.contactName ?? "",
        brand.contactEmail ?? "",
        brand.contactPhone ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data, normalizedSearch]);

  const sortedData = useMemo(() => {
    if (!sort) {
      return filteredData;
    }

    const column = columns.find((item) => item.id === sort.id);
    if (!column) {
      return filteredData;
    }

    const accessor = column.sortAccessor ?? ((row: AdminBrandSummary) => {
      const value = (row as unknown as Record<string, unknown>)[column.id];
      if (typeof value === "number") return value;
      return typeof value === "string" ? value.toLowerCase() : 0;
    });

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = accessor(a);
      const bValue = accessor(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return aValue - bValue;
      }

      return String(aValue).localeCompare(String(bValue));
    });

    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [columns, filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [normalizedSearch, sort?.id, sort?.direction]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  const pageData = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedData.slice(start, end);
  }, [page, sortedData]);

  const from = sortedData.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = sortedData.length === 0 ? 0 : Math.min(sortedData.length, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {sort ? (
          <Button variant="ghost" size="sm" onClick={() => setSort(null)}>
            {resetLabel}
          </Button>
        ) : null}
      </div>

      {sortedData.length === 0 && !normalizedSearch ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Building2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{emptyState}</p>
        </div>
      ) : (
      <div className={dataTableContainerClass}>
        <Table className="min-w-[720px]">
          <TableHeader className={dataTableHeaderClass}>
            <TableRow className={dataTableRowClass}>
              {columns.map((column) => {
                const columnState = {
                  id: column.id,
                  getCanSort: () => Boolean(column.enableSorting),
                  getIsSorted: () => (sort?.id === column.id ? sort.direction : false),
                  toggleSorting: (desc?: boolean) => {
                    if (!column.enableSorting) return;
                    setSort((current) => {
                      if (!current || current.id !== column.id) {
                        return { id: column.id, direction: desc ? "desc" : "asc" };
                      }

                      if (current.direction === "asc") {
                        return desc ? { id: column.id, direction: "desc" } : current;
                      }

                      if (current.direction === "desc") {
                        return desc ? current : null;
                      }

                      return { id: column.id, direction: desc ? "desc" : "asc" };
                    });
                  },
                };
                return (
                  <TableHead key={column.id} className={[column.className, column.align === "right" ? "text-right" : undefined].filter(Boolean).join(" ") || undefined}>
                    <DataTableColumnHeader column={columnState} title={column.title} align={column.align} />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-slate-500">
                  {noResults}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((brand) => (
                <TableRow
                  key={brand.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => router.push(`/admin/brands/${brand.id}`)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={[column.className, column.align === "right" ? "text-right" : undefined].filter(Boolean).join(" ") || undefined}
                      onClick={column.id === "chevron" ? (e) => e.stopPropagation() : undefined}
                    >
                      {column.renderCell(brand)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <div className={dataTableFooterClass}>
        <div>{paginationLabel({ from, to, total: sortedData.length })}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="h-9"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {previousLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1 || sortedData.length === 0}
            className="h-9"
          >
            {nextLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
