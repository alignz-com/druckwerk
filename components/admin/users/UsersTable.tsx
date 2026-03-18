"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dataTableContainerClass,
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { DataTableColumnHeader } from "@/components/admin/brands/data-table-column-header";

type TableRowData = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  roleLabel: string;
  brandName: string | null;
  brandId: string | null;
  createdAtValue: number;
  createdAtLabel: string;
};

type UsersTableProps = {
  data: TableRowData[];
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  paginationLabel: (args: { from: number; to: number; total: number }) => string;
  previousLabel: string;
  nextLabel: string;
  resetLabel: string;
  columns: {
    user: string;
    email: string;
    role: string;
    brand: string;
  };
  onManage?: (id: string) => void;
};

const PAGE_SIZE = 10;

export function UsersTable({
  data,
  searchPlaceholder,
  emptyState,
  noResults,
  paginationLabel,
  previousLabel,
  nextLabel,
  resetLabel,
  columns,
  onManage,
}: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredData = useMemo(() => {
    if (!normalizedSearch) return data;
    return data.filter((row) => {
      const targets = [row.displayName, row.email, row.role, row.brandName ?? ""].join(" ").toLowerCase();
      return targets.includes(normalizedSearch);
    });
  }, [data, normalizedSearch]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const items = [...filteredData];
    items.sort((a, b) => {
      const { id } = sort;
      switch (id) {
        case "user":
          return a.displayName.localeCompare(b.displayName);
        case "email":
          return a.email.localeCompare(b.email);
        case "role":
          return a.role.localeCompare(b.role);
        case "brand":
          return (a.brandName ?? "").localeCompare(b.brandName ?? "");
        case "created":
          return a.createdAtValue - b.createdAtValue;
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

      {sortedData.length === 0 && !normalizedSearch ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{emptyState}</p>
        </div>
      ) : (
      <div className={dataTableContainerClass}>
        <Table className="min-w-[720px]">
          <TableHeader className={dataTableHeaderClass}>
            <TableRow className={dataTableRowClass}>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "user",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "user" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "user") return { id: "user", direction: desc ? "desc" : "asc" };
                        if (current.direction === "asc") return desc ? { id: "user", direction: "desc" } : current;
                        if (current.direction === "desc") return desc ? current : null;
                        return { id: "user", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.user}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "email",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "email" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "email") return { id: "email", direction: desc ? "desc" : "asc" };
                        if (current.direction === "asc") return desc ? { id: "email", direction: "desc" } : current;
                        if (current.direction === "desc") return desc ? current : null;
                        return { id: "email", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.email}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "role",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "role" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "role") return { id: "role", direction: desc ? "desc" : "asc" };
                        if (current.direction === "asc") return desc ? { id: "role", direction: "desc" } : current;
                        if (current.direction === "desc") return desc ? current : null;
                        return { id: "role", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.role}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "brand",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "brand" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "brand") return { id: "brand", direction: desc ? "desc" : "asc" };
                        if (current.direction === "asc") return desc ? { id: "brand", direction: "desc" } : current;
                        if (current.direction === "desc") return desc ? current : null;
                        return { id: "brand", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.brand}
                />
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">
                  {noResults}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row) => (
                <TableRow
                  key={row.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => onManage?.(row.id)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{row.displayName}</div>
                      <div className="text-xs text-slate-500">{row.createdAtLabel}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{row.email}</TableCell>
                  <TableCell className="text-sm uppercase tracking-wide text-slate-500">{row.roleLabel}</TableCell>
                  <TableCell className="text-sm text-slate-600">{row.brandName ?? "—"}</TableCell>
                  <TableCell className="w-10 text-right">
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </TableCell>
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
