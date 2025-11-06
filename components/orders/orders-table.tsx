"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableColumnHeader } from "@/components/admin/brands/data-table-column-header";
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";

const PAGE_SIZE = 10;

export type OrdersTableRow = {
  id: string;
  referenceCode: string;
  createdAtLabel: string;
  createdAtValue: number;
  userName: string | null;
  userEmail: string | null;
  templateLabel: string;
  quantity: number;
  status: string;
  statusLabel: string;
  deliveryTime: string;
  deliveryTimeLabel: string;
  deliveryDueAtLabel: string | null;
  deliveryDueAtValue: number | null;
  templateKey: string | null;
  brandId: string | null;
  detail: {
    requester: {
      name: string;
      role: string;
      email: string;
      phone: string;
      mobile: string;
      url: string;
      linkedin: string;
    };
    company: string;
    address?: Record<string, unknown>;
    quantity: number;
    deliveryTime: string;
    deliveryTimeLabel: string;
    customerReference: string;
    brandName: string;
    templateLabel: string;
    deliveryDueAtLabel: string | null;
  };
};

type OrdersTableColumn = {
  id: string;
  title: string;
  align?: "left" | "right";
  enableSorting?: boolean;
  sortAccessor?: (row: OrdersTableRow) => string | number;
  renderCell: (row: OrdersTableRow) => ReactNode;
};

type OrdersTableProps = {
  data: OrdersTableRow[];
  showUserColumn: boolean;
  labels: {
    created: string;
    user: string;
    template: string;
    quantity: string;
    status: string;
    delivery: string;
    view: string;
  };
  detailLabels: OrderDetailLabels;
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  pagination: {
    labelTemplate: string;
    previous: string;
    next: string;
    reset: string;
  };
  selectionLabelTemplate?: string;
  renderActions?: (selectedIds: string[]) => ReactNode;
};

export function OrdersTable({
  data,
  showUserColumn,
  labels,
  detailLabels,
  searchPlaceholder,
  emptyState,
  noResults,
  pagination,
  selectionLabelTemplate,
  renderActions,
}: OrdersTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<OrdersTableRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const normalizedSearch = search.trim().toLowerCase();

  const handleOpenDetail = useCallback((row: OrdersTableRow) => {
    setDetailOrder(row);
    setDetailOpen(true);
  }, []);

  const columns = useMemo<OrdersTableColumn[]>(() => {
    const baseColumns: OrdersTableColumn[] = [
      {
        id: "created",
        title: labels.created,
        enableSorting: true,
        sortAccessor: (row) => row.createdAtValue,
        renderCell: (row) => <span className="text-slate-600">{row.createdAtLabel}</span>,
      },
      {
        id: "template",
        title: labels.template,
        enableSorting: true,
        sortAccessor: (row) => row.templateLabel.toLowerCase(),
        renderCell: (row) => <span className="text-slate-600">{row.templateLabel}</span>,
      },
      {
        id: "quantity",
        title: labels.quantity,
        align: "right",
        enableSorting: true,
        sortAccessor: (row) => row.quantity,
        renderCell: (row) => <span className="text-slate-600">{row.quantity}</span>,
      },
      {
        id: "delivery",
        title: labels.delivery,
        enableSorting: true,
        sortAccessor: (row) => row.deliveryDueAtValue ?? Number.MAX_SAFE_INTEGER,
        renderCell: (row) => (
          <div className="space-y-1">
            <Badge variant={row.deliveryTime === "express" ? "destructive" : "outline"}>{row.deliveryTimeLabel}</Badge>
            {row.deliveryDueAtLabel ? (
              <p className="text-xs text-slate-500">{row.deliveryDueAtLabel}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        title: labels.status,
        enableSorting: true,
        sortAccessor: (row) => row.statusLabel.toLowerCase(),
        renderCell: (row) => (
          <Badge variant={row.status === "SUBMITTED" ? "secondary" : "outline"}>{row.statusLabel}</Badge>
        ),
      },
      {
        id: "actions",
        title: "",
        renderCell: (row) => (
          <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(row)}>
            {labels.view}
          </Button>
        ),
      },
    ];

    if (showUserColumn) {
      baseColumns.splice(2, 0, {
        id: "user",
        title: labels.user,
        enableSorting: true,
        sortAccessor: (row) => `${row.userName ?? ""} ${row.userEmail ?? ""}`.trim().toLowerCase(),
        renderCell: (row) => (
          <div className="text-slate-600">
            {row.userName ?? row.userEmail ?? "–"}
            {row.userEmail ? <span className="block text-xs text-slate-400">{row.userEmail}</span> : null}
          </div>
        ),
      });
    }

    return baseColumns;
  }, [labels, showUserColumn, handleOpenDetail]);

  const filteredData = useMemo(() => {
    if (!normalizedSearch) {
      return data;
    }

    return data.filter((order) => {
      const haystack = [
        order.referenceCode,
        order.templateLabel,
        order.statusLabel,
        order.userName ?? "",
        order.userEmail ?? "",
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

    const accessor = column.sortAccessor ?? ((row: OrdersTableRow) => {
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
  const pageIds = useMemo(() => pageData.map((row) => row.id), [pageData]);
  const selectedCount = selected.size;
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = !allPageSelected && pageIds.some((id) => selected.has(id));
  const selectedLabel =
    selectedCount > 0 && selectionLabelTemplate
      ? selectionLabelTemplate.replace("{count}", String(selectedCount))
      : null;

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

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-end gap-2">
          {sort ? (
            <Button variant="ghost" size="sm" onClick={() => setSort(null)}>
              {pagination.reset}
            </Button>
          ) : null}
          {selectedLabel ? (
            <div className="text-sm text-slate-500">{selectedLabel}</div>
          ) : null}
          {renderActions ? renderActions(Array.from(selected)) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-slate-50/60">
            <TableRow className="border-slate-200">
              <TableHead className="w-12 px-4">
                <Checkbox
                  aria-label="Select all rows"
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={(value) => togglePageSelection(value === true)}
                />
              </TableHead>
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
                <TableHead key={column.id} className={column.align === "right" ? "text-right" : undefined}>
                  <DataTableColumnHeader column={columnState} title={column.title} align={column.align} />
                </TableHead>
              );
            })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-12 text-center text-sm text-slate-500">
                  {sortedData.length === 0 ? (normalizedSearch ? noResults : emptyState) : emptyState}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((order) => (
                <TableRow key={order.id} className="border-slate-200">
                  <TableCell className="w-12 px-4">
                    <Checkbox
                      aria-label={`Select ${order.referenceCode}`}
                      checked={selected.has(order.id)}
                      onCheckedChange={(value) => toggleRowSelection(order.id, value === true)}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.align === "right" ? "text-right" : undefined}>
                      {column.renderCell(order)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {pagination.labelTemplate
            .replace("{from}", String(from))
            .replace("{to}", String(to))
            .replace("{total}", String(sortedData.length))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="h-9"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {pagination.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1 || sortedData.length === 0}
            className="h-9"
          >
            {pagination.next}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <OrderDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailOrder(null);
          }
        }}
        order={detailOrder}
        labels={detailLabels}
      />
    </div>
  );
}
export type OrderDetailLabels = {
  title: string;
  status: string;
  brand: string;
  template: string;
  quantity: string;
  delivery: string;
  customerReference: string;
  requester: string;
  company: string;
  address: string;
  contact: string;
  previewTitle: string;
  close: string;
  loadingTemplate: string;
  loadingPreview: string;
  noTemplate: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  mobile: string;
  url: string;
  linkedin: string;
  companyName: string;
};
