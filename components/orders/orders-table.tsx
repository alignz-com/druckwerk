"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableColumnHeader } from "@/components/admin/shared/DataTableColumnHeader";
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  SUBMITTED: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  IN_PRODUCTION: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  READY_FOR_DELIVERY: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  COMPLETED: { bg: "bg-slate-300", text: "text-slate-900", border: "border-slate-400" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};

export type OrdersTableRow = {
  id: string;
  referenceCode: string;
  orderType?: "TEMPLATE" | "UPLOAD";
  createdAtLabel: string;
  createdAtValue: number;
  userName: string | null;
  userEmail: string | null;
  templateLabel: string;
  quantity: number;
  quantityLabel: string;
  status: string;
  statusLabel: string;
  deliveryTime: string;
  deliveryTimeLabel: string;
  deliveryDueAtLabel: string | null;
  deliveryDueAtValue: number | null;
  templateKey: string | null;
  brandId: string | null;
  brandName: string | null;
  allowedQuantities: number[];
  detail: {
    requester: {
      name: string;
      role: string;
      seniority: string;
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
    qrMode?: "vcard" | "public";
    publicProfileUrl?: string | null;
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
  showBrandColumn: boolean;
  locale: string;
  canEditQuantity?: boolean;
  canRegenerateJdf?: boolean;
  labels: {
    brand: string;
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
  filters?: {
    brand?: {
      label: string;
      allLabel: string;
      options: { value: string; label: string }[];
    };
    status?: {
      label: string;
      allLabel: string;
      options: { value: string; label: string }[];
    };
  };
  bulkStatus?: {
    options: { value: string; label: string }[];
    labels: {
      label: string;
      placeholder: string;
      apply: string;
      success: string;
      error: string;
    };
  };
  bulkDelivery?: {
    label: string;
    apply: string;
    creating: string;
    success: string;
    error: string;
    noteLabel: string;
    notePlaceholder: string;
  };
};

export function OrdersTable({
  data,
  showBrandColumn,
  locale,
  canEditQuantity = false,
  canRegenerateJdf = false,
  labels,
  detailLabels,
  searchPlaceholder,
  emptyState,
  noResults,
  pagination,
  selectionLabelTemplate,
  filters,
  bulkStatus,
  bulkDelivery,
}: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<OrdersTableRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");
  const [bulkStatusMessage, setBulkStatusMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCreateDeliveryOpen, setIsCreateDeliveryOpen] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [deliveryAddressId, setDeliveryAddressId] = useState<string>("");
  const [deliveryAddresses, setDeliveryAddresses] = useState<
    Array<{ id: string; label: string; street?: string | null; city?: string | null; postalCode?: string | null }>
  >([]);
  const [deliveryAddressesLoading, setDeliveryAddressesLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const orderById = useMemo(() => {
    const map = new Map<string, OrdersTableRow>();
    for (const row of data) {
      map.set(row.id, row);
    }
    return map;
  }, [data]);

  const normalizedSearch = search.trim().toLowerCase();

  const updateDetailParam = useCallback(
    (nextId: string | null) => {
      const params = new URLSearchParams(searchParamsString);
      if (nextId) {
        params.set("detail", nextId);
      } else {
        params.delete("detail");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const handleOpenDetail = useCallback(
    (row: OrdersTableRow) => {
      setDetailOrder(row);
      setDetailOpen(true);
      updateDetailParam(row.id);
    },
    [updateDetailParam],
  );

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      setDetailOpen(open);
      if (!open) {
        setDetailOrder(null);
        updateDetailParam(null);
      }
    },
    [updateDetailParam],
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const targetId = params.get("detail");
    if (targetId) {
      const row = orderById.get(targetId);
      if (row) {
        setDetailOrder(row);
        setDetailOpen(true);
        return;
      }
    }
    setDetailOpen(false);
    setDetailOrder(null);
  }, [orderById, searchParamsString]);

  const columns = useMemo<OrdersTableColumn[]>(() => {
    const baseColumns: OrdersTableColumn[] = [];

    if (showBrandColumn) {
      baseColumns.push({
        id: "brand",
        title: labels.brand,
        enableSorting: true,
        sortAccessor: (row) => (row.brandName ?? "").toLowerCase(),
        renderCell: (row) => <span className="text-slate-600">{row.brandName ?? "–"}</span>,
      });
    }

    baseColumns.push(
      {
        id: "requester",
        title: labels.user,
        enableSorting: true,
        sortAccessor: (row) => `${row.detail.requester.name ?? ""} ${row.detail.requester.role ?? ""}`
          .trim()
          .toLowerCase(),
        renderCell: (row) => (
          <div className="text-slate-600">
            <span className="font-medium text-slate-900">{row.detail.requester.name || row.userEmail || "–"}</span>
            {row.detail.requester.role ? (
              <span className="block text-xs text-slate-500">{row.detail.requester.role}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: "template",
        title: labels.template,
        enableSorting: true,
        sortAccessor: (row) => row.templateLabel.toLowerCase(),
        renderCell: (row) => (
          <div className="flex items-center gap-2">
            {row.orderType === "UPLOAD" && (
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                PDF
              </span>
            )}
            <span className="text-slate-600">{row.orderType === "UPLOAD" ? "PDF Print" : row.templateLabel}</span>
          </div>
        ),
      },
      {
        id: "quantity",
        title: labels.quantity,
        align: "right",
        enableSorting: true,
        sortAccessor: (row) => row.quantity,
        renderCell: (row) => <span className="text-slate-600">{row.quantityLabel}</span>,
      },
      {
        id: "created",
        title: labels.created,
        enableSorting: true,
        sortAccessor: (row) => row.createdAtValue,
        renderCell: (row) => <span className="text-slate-600">{row.createdAtLabel}</span>,
      },
      {
        id: "delivery",
        title: labels.delivery,
        enableSorting: true,
        sortAccessor: (row) => row.deliveryDueAtValue ?? Number.MAX_SAFE_INTEGER,
        renderCell: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-700">{row.deliveryDueAtLabel ?? "—"}</span>
            {row.deliveryTime === "express" ? <Badge variant="destructive">{row.deliveryTimeLabel}</Badge> : null}
          </div>
        ),
      },
      {
        id: "status",
        title: labels.status,
        enableSorting: true,
        sortAccessor: (row) => row.statusLabel.toLowerCase(),
        renderCell: (row) => (
          <Badge
            className={cn(
              "border text-xs font-medium",
              STATUS_COLOR[row.status]?.bg ?? "bg-slate-100",
              STATUS_COLOR[row.status]?.text ?? "text-slate-700",
              STATUS_COLOR[row.status]?.border ?? "border-slate-200",
            )}
          >
            {row.statusLabel}
          </Badge>
        ),
      },
      {
        id: "actions",
        title: labels.view,
        align: "right",
        renderCell: (row) => (
          <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(row)}>
            {labels.view}
          </Button>
        ),
      },
    );

    return baseColumns;
  }, [labels, showBrandColumn, handleOpenDetail]);

  const filteredData = useMemo(() => {
    return data.filter((order) => {
      if (brandFilter !== "all" && order.brandId !== brandFilter) return false;
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        order.referenceCode,
        order.templateLabel,
        order.statusLabel,
        order.userName ?? "",
        order.userEmail ?? "",
        order.brandName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data, normalizedSearch, brandFilter, statusFilter]);

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

  const selectedBrandId = useMemo(() => {
    const selectedRows = data.filter((row) => selected.has(row.id));
    if (selectedRows.length === 0) return null;
    const brandIds = new Set(selectedRows.map((row) => row.brandId).filter(Boolean) as string[]);
    if (brandIds.size === 1) return Array.from(brandIds)[0];
    return null;
  }, [data, selected]);

  useEffect(() => {
    if (!isCreateDeliveryOpen) return;
    if (!selectedBrandId) {
      setDeliveryAddresses([]);
      setDeliveryAddressId("");
      return;
    }
    setDeliveryAddressesLoading(true);
    fetch(`/api/printer/brands/${selectedBrandId}/addresses`)
      .then((res) => res.json())
      .then((payload) => {
        const addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
        setDeliveryAddresses(addresses);
        setDeliveryAddressId(addresses[0]?.id ?? "");
      })
      .catch(() => {
        setDeliveryAddresses([]);
        setDeliveryAddressId("");
      })
      .finally(() => setDeliveryAddressesLoading(false));
  }, [selectedBrandId, isCreateDeliveryOpen]);

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || !bulkStatusValue || selected.size === 0) return;
    setIsBulkUpdating(true);
    setBulkStatusMessage(null);
    try {
      const response = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selected), status: bulkStatusValue }),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setBulkStatusMessage({ text: bulkStatus.labels.success, tone: "success" });
      setSelected(new Set());
      setBulkStatusValue("");
      router.refresh();
    } catch (error) {
      console.error("[orders] bulk status update failed", error);
      setBulkStatusMessage({ text: bulkStatus.labels.error, tone: "error" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleCreateDelivery = async () => {
    if (!bulkDelivery || selected.size === 0 || !deliveryAddressId) return;
    setIsCreatingDelivery(true);
    setDeliveryMessage(null);
    try {
      const response = await fetch("/api/printer/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: Array.from(selected),
          note: deliveryNote.trim() || undefined,
          addressId: deliveryAddressId,
        }),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      const data = await response.json();
      router.push(`/confirmations/${data.delivery.id}`);
    } catch (error) {
      console.error("[deliveries] create delivery failed", error);
      setDeliveryMessage({ text: bulkDelivery.error, tone: "error" });
    } finally {
      setIsCreatingDelivery(false);
    }
  };

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {filters && selectedCount === 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {filters.brand ? (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-9 min-w-[9rem] text-xs">
                    <SelectValue placeholder={filters.brand.allLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{filters.brand.allLabel}</SelectItem>
                    {filters.brand.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {filters.status ? (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 min-w-[9rem] text-xs">
                    <SelectValue placeholder={filters.status.allLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{filters.status.allLabel}</SelectItem>
                    {filters.status.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
          {sort ? (
            <Button variant="ghost" size="sm" onClick={() => setSort(null)}>
              {pagination.reset}
            </Button>
          ) : null}
          {selectedLabel ? <div className="text-sm text-slate-500">{selectedLabel}</div> : null}
          {selectedCount > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              {bulkStatus ? (
                <>
                  <Select value={bulkStatusValue || undefined} onValueChange={setBulkStatusValue}>
                    <SelectTrigger className="h-9 w-40 text-xs">
                      <SelectValue placeholder={bulkStatus.labels.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkStatus.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LoadingButton type="button" onClick={handleBulkStatusUpdate} disabled={!bulkStatusValue} loading={isBulkUpdating} loadingText="…" minWidthClassName="min-w-[120px]">
                    {bulkStatus.labels.apply}
                  </LoadingButton>
                </>
              ) : null}
              {bulkDelivery ? (
                <LoadingButton
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDeliveryOpen(true)}
                  disabled={!selectedBrandId}
                  loading={isCreatingDelivery}
                  loadingText={bulkDelivery.creating}
                  minWidthClassName="min-w-[140px]"
                >
                  {bulkDelivery.apply}
                </LoadingButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {bulkStatusMessage ? (
        <div className={`text-sm ${bulkStatusMessage.tone === "success" ? "text-emerald-600" : "text-red-600"}`}>
          {bulkStatusMessage.text}
        </div>
      ) : null}
      {deliveryMessage ? (
        <div className={`text-sm ${deliveryMessage.tone === "success" ? "text-emerald-600" : "text-red-600"}`}>
          {deliveryMessage.text}
        </div>
      ) : null}

      <div className={cn("overflow-x-auto rounded-md border border-slate-200", "mt-4")}>
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

      {bulkDelivery ? (
        <Dialog open={isCreateDeliveryOpen} onOpenChange={setIsCreateDeliveryOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{bulkDelivery.label}</DialogTitle>
              </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-900">Ship to</div>
                {deliveryAddressesLoading ? (
                  <div className="text-xs text-slate-500">Loading addresses…</div>
                ) : deliveryAddresses.length === 0 ? (
                  <div className="text-xs text-red-600">No addresses for this brand.</div>
                ) : (
                  <Select value={deliveryAddressId} onValueChange={setDeliveryAddressId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select address" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryAddresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea
                placeholder={bulkDelivery.notePlaceholder}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-slate-500">
                {selectedCount} {selectedCount === 1 ? "order" : "orders"} selected
              </p>
            </div>
            <DialogFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDeliveryOpen(false)}>
                Cancel
              </Button>
              <LoadingButton
                type="button"
                onClick={handleCreateDelivery}
                disabled={
                  !deliveryAddressId ||
                  deliveryAddresses.length === 0 ||
                  deliveryAddressesLoading
                }
                loading={isCreatingDelivery}
                loadingText={bulkDelivery.creating}
                minWidthClassName="min-w-[140px]"
              >
                {bulkDelivery.apply}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <OrderDetailSheet
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        order={detailOrder}
        labels={detailLabels}
        canEditQuantity={canEditQuantity}
        canRegenerateJdf={canRegenerateJdf}
        locale={locale}
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
  actionsTitle: string;
  close: string;
  loadingTemplate: string;
  loadingPreview: string;
  noTemplate: string;
  name: string;
  role: string;
  seniority: string;
  email: string;
  phone: string;
  mobile: string;
  url: string;
  linkedin: string;
  companyName: string;
  deleteAction: string;
  deleteRunning: string;
  deleteConfirm: string;
  deleteError: string;
};
