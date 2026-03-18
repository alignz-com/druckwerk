"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutTemplate, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/admin/brands/data-table-column-header";
import {
  dataTableContainerClass,
  dataTableFooterClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";

const PAGE_SIZE = 10;

type TemplateRow = {
  id: string;
  label: string;
  key: string;
  brandNames: string[];
  assetStatus: { message: string; tone: "ok" | "warning" };
  updatedAtLabel: string;
  updatedAtValue: number;
  brandCount: number;
};

type TemplatesTableProps = {
  data: TemplateRow[];
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  paginationLabel: (args: { from: number; to: number; total: number }) => string;
  previousLabel: string;
  nextLabel: string;
  resetLabel: string;
  deleteLabel: string;
  selectionLabel: (count: number) => string;
  columns: {
    template: string;
    brands: string;
    assetStatus: string;
    updated: string;
  };
  unassignedLabel: string;
  onManage?: (id: string) => void;
  onDeleteSelected?: (ids: string[]) => Promise<boolean | void>;
  isDeleting?: boolean;
};

export function TemplatesTable({
  data,
  searchPlaceholder,
  emptyState,
  noResults,
  paginationLabel,
  previousLabel,
  nextLabel,
  resetLabel,
  deleteLabel,
  selectionLabel,
  columns,
  unassignedLabel,
  onManage,
  onDeleteSelected,
  isDeleting = false,
}: TemplatesTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const normalizedSearch = search.trim().toLowerCase();

  const filteredData = useMemo(() => {
    if (!normalizedSearch) return data;
    return data.filter((row) => {
      const haystack = [row.label, row.key, ...row.brandNames].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [data, normalizedSearch]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      switch (sort.id) {
        case "label": {
          return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
        }
        case "brands": {
          return a.brandCount - b.brandCount;
        }
        case "updated": {
          return a.updatedAtValue - b.updatedAtValue;
        }
        default:
          return 0;
      }
    });

    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedData.slice(start, end);
  }, [page, sortedData]);

  const from = sortedData.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = sortedData.length === 0 ? 0 : Math.min(sortedData.length, (page + 1) * PAGE_SIZE);
  const pageIds = useMemo(() => pageData.map((row) => row.id), [pageData]);
  const selectedCount = selected.size;
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = !allPageSelected && pageIds.some((id) => selected.has(id));

  const togglePageSelection = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const toggleRowSelection = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!onDeleteSelected || selected.size === 0) return;
    const result = await onDeleteSelected(Array.from(selected));
    if (result === false) {
      return;
    }
    setSelected(new Set());
  };

  useEffect(() => {
    const ids = new Set(data.map((item) => item.id));
    setSelected((current) => {
      const next = new Set<string>();
      for (const id of current) {
        if (ids.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    setPage(0);
  }, [normalizedSearch, sort?.id, sort?.direction]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sort ? (
            <Button variant="ghost" size="sm" onClick={() => setSort(null)}>
              {resetLabel}
            </Button>
          ) : null}
          {selectedCount > 0 ? (
            <div className="text-sm text-slate-500">{selectionLabel(selectedCount)}</div>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0 || !onDeleteSelected || isDeleting}
            onClick={handleDeleteSelected}
          >
            {isDeleting ? `${deleteLabel}…` : deleteLabel}
          </Button>
        </div>
      </div>

      {sortedData.length === 0 && !normalizedSearch ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          <LayoutTemplate className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{emptyState}</p>
        </div>
      ) : (
      <div className={dataTableContainerClass}>
        <Table className="min-w-[720px]">
          <TableHeader className={dataTableHeaderClass}>
            <TableRow className={dataTableRowClass}>
              <TableHead className="w-12 px-4">
                <Checkbox
                  aria-label="Select all templates"
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={(value) => togglePageSelection(value === true)}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "label",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "label" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "label") {
                          return { id: "label", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "label", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "label", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.template}
                />
              </TableHead>
              <TableHead>
                <DataTableColumnHeader
                  column={{
                    id: "brands",
                    getCanSort: () => true,
                    getIsSorted: () => (sort?.id === "brands" ? sort.direction : false),
                    toggleSorting: (desc) =>
                      setSort((current) => {
                        if (!current || current.id !== "brands") {
                          return { id: "brands", direction: desc ? "desc" : "asc" };
                        }
                        if (current.direction === "asc") {
                          return desc ? { id: "brands", direction: "desc" } : current;
                        }
                        if (current.direction === "desc") {
                          return desc ? current : null;
                        }
                        return { id: "brands", direction: desc ? "desc" : "asc" };
                      }),
                  }}
                  title={columns.brands}
                />
              </TableHead>
              <TableHead>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {columns.assetStatus}
                </span>
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
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
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
                  <TableCell className="w-12 px-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${row.label}`}
                      checked={selected.has(row.id)}
                      onCheckedChange={(value) => toggleRowSelection(row.id, value === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{row.label}</div>
                      <div className="text-xs text-slate-500">{row.key}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.brandNames.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.brandNames.map((name) => (
                          <Badge key={name} variant="outline">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600">{unassignedLabel}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        row.assetStatus.tone === "warning"
                          ? "text-xs font-medium text-amber-600"
                          : "text-xs font-medium text-emerald-600"
                      }
                    >
                      {row.assetStatus.message}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-500">{row.updatedAtLabel}</TableCell>
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
