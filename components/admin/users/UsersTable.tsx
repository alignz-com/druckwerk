"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dataTableContainerClass,
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { DataTableColumnHeader } from "@/components/admin/shared/DataTableColumnHeader";

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
  allRolesLabel: string;
  allBrandsLabel: string;
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
  allRolesLabel,
  allBrandsLabel,
  paginationLabel,
  previousLabel,
  nextLabel,
  resetLabel,
  columns,
  onManage,
}: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const normalizedSearch = search.trim().toLowerCase();

  const availableRoles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data) {
      if (!seen.has(row.role)) seen.set(row.role, row.roleLabel);
    }
    return Array.from(seen.entries()).map(([role, label]) => ({ role, label }));
  }, [data]);

  const availableBrands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data) {
      if (row.brandId && row.brandName && !seen.has(row.brandId)) {
        seen.set(row.brandId, row.brandName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      if (brandFilter && row.brandId !== brandFilter) return false;
      if (normalizedSearch) {
        const targets = [row.displayName, row.email, row.brandName ?? ""].join(" ").toLowerCase();
        if (!targets.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [data, normalizedSearch, roleFilter, brandFilter]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const items = [...filteredData];
    items.sort((a, b) => {
      switch (sort.id) {
        case "user": return a.displayName.localeCompare(b.displayName);
        case "brand": return (a.brandName ?? "").localeCompare(b.brandName ?? "");
        default: return 0;
      }
    });
    return sort.direction === "asc" ? items : items.reverse();
  }, [filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedData.slice(start, start + PAGE_SIZE);
  }, [page, sortedData]);

  useEffect(() => { setPage(0); }, [normalizedSearch, roleFilter, brandFilter, sort?.id, sort?.direction]);
  useEffect(() => { if (page > totalPages - 1) setPage(totalPages - 1); }, [page, totalPages]);

  const from = sortedData.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = sortedData.length === 0 ? 0 : Math.min(sortedData.length, (page + 1) * PAGE_SIZE);

  const hasActiveFilters = !!roleFilter || !!brandFilter || !!normalizedSearch;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          {availableBrands.length > 0 && (
            <Select value={brandFilter ?? "all"} onValueChange={(v) => setBrandFilter(v === "all" ? null : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={allBrandsLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allBrandsLabel}</SelectItem>
                {availableBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sort && (
            <Button variant="ghost" size="sm" onClick={() => setSort(null)}>{resetLabel}</Button>
          )}
        </div>

        {/* Role pills */}
        {availableRoles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRoleFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !roleFilter
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {allRolesLabel}
            </button>
            {availableRoles.map(({ role, label }) => (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  roleFilter === role
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.length === 0 ? (
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
                      setSort((cur) => {
                        if (!cur || cur.id !== "user") return { id: "user", direction: desc ? "desc" : "asc" };
                        if (cur.direction === "asc") return desc ? { id: "user", direction: "desc" } : cur;
                        if (cur.direction === "desc") return desc ? cur : null;
                        return { id: "user", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.user}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">{columns.email}</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">{columns.role}</TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "brand",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "brand" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((cur) => {
                        if (!cur || cur.id !== "brand") return { id: "brand", direction: desc ? "desc" : "asc" };
                        if (cur.direction === "asc") return desc ? { id: "brand", direction: "desc" } : cur;
                        if (cur.direction === "desc") return desc ? cur : null;
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
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-9">
            <ChevronLeft className="mr-1 h-4 w-4" />{previousLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || sortedData.length === 0} className="h-9">
            {nextLabel}<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
