"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
  dataTableFooterClass,
} from "@/components/admin/shared/data-table-styles";
import { DataTableColumnHeader } from "@/components/admin/brands/data-table-column-header";

type TableRowData = {
  id: string;
  name: string;
  slug: string;
  variantCount: number;
  variantSummary: string;
  updatedAtLabel: string;
  updatedAtValue: number;
};

type FontsTableProps = {
  data: TableRowData[];
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  paginationLabel: (args: { from: number; to: number; total: number }) => string;
  previousLabel: string;
  nextLabel: string;
  resetLabel: string;
  manageLabel: string;
  columns: {
    family: string;
    slug: string;
    variants: string;
    updated: string;
    actions: string;
  };
  onManage?: (id: string) => void;
};

const PAGE_SIZE = 10;

export function FontsTable({
  data,
  searchPlaceholder,
  emptyState,
  noResults,
  paginationLabel,
  previousLabel,
  nextLabel,
  resetLabel,
  manageLabel,
  columns,
  onManage,
}: FontsTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredData = useMemo(() => {
    if (!normalizedSearch) return data;
    return data.filter((row) => {
      const haystack = [row.name, row.slug, row.variantSummary].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [data, normalizedSearch]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const items = [...filteredData];
    items.sort((a, b) => {
      switch (sort.id) {
        case "family":
          return a.name.localeCompare(b.name);
        case "slug":
          return a.slug.localeCompare(b.slug);
        case "variants":
          return a.variantCount - b.variantCount;
        case "updated":
          return a.updatedAtValue - b.updatedAtValue;
        default:
          return 0;
      }
    });
    return sort.direction === "asc" ? items : items.reverse();
  }, [filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedData.slice(start, start + PAGE_SIZE);
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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
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

      <div className={dataTableContainerClass}>
        <Table className="min-w-[720px]">
          <TableHeader className={dataTableHeaderClass}>
            <TableRow className={dataTableRowClass}>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "family",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "family" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "family") {
                          return { id: "family", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "family", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "family", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.family}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "slug",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "slug" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "slug") {
                          return { id: "slug", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "slug", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "slug", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.slug}
                />
              </TableHead>
              <TableHead className="text-right">
                <DataTableColumnHeader
                  column={{
                    id: "variants",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "variants" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "variants") {
                          return { id: "variants", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "variants", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "variants", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.variants}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <DataTableColumnHeader
                  column={{
                    id: "updated",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "updated" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "updated") {
                          return { id: "updated", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "updated", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "updated", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.updated}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {columns.actions}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">
                  {sortedData.length === 0 ? (normalizedSearch ? noResults : emptyState) : emptyState}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row) => (
                <TableRow key={row.id} className={dataTableRowClass}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.variantSummary}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{row.slug}</TableCell>
                  <TableCell className="text-right text-sm text-slate-600">{row.variantCount}</TableCell>
                  <TableCell className="text-right text-sm text-slate-600">{row.updatedAtLabel}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onManage?.(row.id)}>
                      {manageLabel}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
          </Button>
        </div>
      </div>
    </div>
  );
}
