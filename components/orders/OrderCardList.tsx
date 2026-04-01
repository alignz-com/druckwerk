"use client";

import * as React from "react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, LayoutList, Kanban, ListChecks } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderCardRow, type OrderCardData } from "./OrderCardRow";
import { OrderKanban } from "./OrderKanban";

const VIEW_KEY = "orders-view";

const PAGE_SIZE = 20;

type BrandOption = { value: string; label: string };
type StatusOption = { value: string; label: string };

type BulkLabels = {
  selectMode: string;
  cancelSelect: string;
  selectedCount: string;
  statusPlaceholder: string;
  applyStatus: string;
  applying: string;
  statusSuccess: string;
  statusError: string;
  createDelivery: string;
  deliveryTitle: string;
  deliveryAddress: string;
  loadingAddresses: string;
  noAddresses: string;
  deliveryNoteLabel: string;
  deliveryNotePlaceholder: string;
  deliveryCreate: string;
  deliveryCreating: string;
  deliverySuccess: string;
  deliveryError: string;
  deliveryMixedBrands: string;
  kanbanShowMore: string;
};

type Props = {
  orders: OrderCardData[];
  showBrand: boolean;
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
  allStatusesLabel: string;
  allBrandsLabel: string;
  statusOptions: StatusOption[];
  brandOptions: BrandOption[];
  paginationLabelTemplate: string;
  previousLabel: string;
  nextLabel: string;
  bulkLabels?: BulkLabels;
};

type Address = {
  id: string;
  label: string;
  company: string;
  street: string;
  city: string;
  postalCode: string;
};

export function OrderCardList({
  orders,
  showBrand,
  searchPlaceholder,
  emptyState,
  noResults,
  allStatusesLabel,
  allBrandsLabel,
  statusOptions,
  brandOptions,
  paginationLabelTemplate,
  previousLabel,
  nextLabel,
  bulkLabels,
}: Props) {
  const router = useRouter();

  // View toggle (list vs kanban) — admin/printer only, persisted
  const [view, setView] = useState<"list" | "kanban">("list");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "kanban" || stored === "list") setView(stored);
    } catch {}
  }, []);
  const setViewAndPersist = useCallback((v: "list" | "kanban") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }, []);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk action state
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkActionState, setBulkActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [bulkMessage, setBulkMessage] = useState("");

  // Delivery dialog
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryAddresses, setDeliveryAddresses] = useState<Address[]>([]);
  const [deliveryAddressLoading, setDeliveryAddressLoading] = useState(false);
  const [deliveryAddressId, setDeliveryAddressId] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryState, setDeliveryState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [deliveryMessage, setDeliveryMessage] = useState("");

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, brandFilter]);

  // Reset bulk state when select mode exits
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkStatus("");
    setBulkActionState("idle");
    setBulkMessage("");
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (brandFilter && o.brandId !== brandFilter) return false;
      if (q) {
        return (
          o.referenceCode.toLowerCase().includes(q) ||
          (o.requesterName?.toLowerCase().includes(q) ?? false) ||
          (o.brandName?.toLowerCase().includes(q) ?? false) ||
          (o.templateLabel?.toLowerCase().includes(q) ?? false) ||
          (o.company?.toLowerCase().includes(q) ?? false) ||
          (o.orderedByName?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter, brandFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const paginationLabel = paginationLabelTemplate
    .replace("{from}", String(from))
    .replace("{to}", String(to))
    .replace("{total}", String(filtered.length));

  // Bulk status apply
  const handleApplyStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setBulkActionState("loading");
    setBulkMessage("");
    try {
      const res = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selected), status: bulkStatus }),
      });
      if (!res.ok) throw new Error();
      setBulkActionState("success");
      setBulkMessage(bulkLabels?.statusSuccess ?? "");
      setTimeout(() => {
        router.refresh();
        exitSelectMode();
      }, 1200);
    } catch {
      setBulkActionState("error");
      setBulkMessage(bulkLabels?.statusError ?? "");
    }
  };

  // Open delivery dialog — check same brand
  const handleOpenDelivery = () => {
    if (!bulkLabels) return;
    const selectedOrders = orders.filter((o) => selected.has(o.id));
    const brandIds = new Set(selectedOrders.map((o) => o.brandId).filter(Boolean));
    if (brandIds.size !== 1) {
      setBulkActionState("error");
      setBulkMessage(bulkLabels.deliveryMixedBrands);
      return;
    }
    setDeliveryOpen(true);
    setDeliveryAddressId("");
    setDeliveryNote("");
    setDeliveryState("idle");
    setDeliveryMessage("");

    const brandId = Array.from(brandIds)[0] as string;
    setDeliveryAddressLoading(true);
    fetch(`/api/printer/brands/${brandId}/addresses`)
      .then((r) => r.json())
      .then((data) => {
        setDeliveryAddresses(data.addresses ?? []);
        if ((data.addresses ?? []).length > 0) {
          setDeliveryAddressId(data.addresses[0].id);
        }
      })
      .catch(() => setDeliveryAddresses([]))
      .finally(() => setDeliveryAddressLoading(false));
  };

  const handleCreateDelivery = async () => {
    if (!deliveryAddressId || selected.size === 0) return;
    setDeliveryState("loading");
    try {
      const res = await fetch("/api/printer/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: Array.from(selected),
          addressId: deliveryAddressId,
          note: deliveryNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(`/confirmations/${data.delivery.id}`);
    } catch {
      setDeliveryState("error");
      setDeliveryMessage(bulkLabels?.deliveryError ?? "");
    }
  };

  const showBrandFilter = showBrand && brandOptions.length > 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Search + brand filter + view/select toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {/* Brand filter — compact, inline */}
        {showBrandFilter && (
          <select
            value={brandFilter ?? ""}
            onChange={(e) => setBrandFilter(e.target.value || null)}
            className="shrink-0 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 max-w-[160px]"
          >
            <option value="">{allBrandsLabel}</option>
            {brandOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* View toggle */}
        {bulkLabels && (
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
            <button
              onClick={() => { setViewAndPersist("list"); exitSelectMode(); }}
              className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${view === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setViewAndPersist("kanban"); exitSelectMode(); }}
              className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${view === "kanban" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Select mode — separate from view toggle */}
        {bulkLabels && (
          <button
            onClick={() => {
              if (selectMode) exitSelectMode();
              else { setSelectMode(true); setSelected(new Set()); }
            }}
            className={`flex items-center justify-center h-8 w-8 rounded-lg border transition-colors shrink-0 ${
              selectMode
                ? "bg-slate-900 border-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <ListChecks className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 2: Status pills — always rendered to reserve height, invisible in kanban */}
      <div className={view === "kanban" ? "invisible" : ""}>
        <div className="overflow-x-auto">
          <div className="flex gap-1.5 min-w-max pb-1">
            <button
              onClick={() => setStatusFilter(null)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                statusFilter === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {allStatusesLabel}
            </button>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(statusFilter === opt.value ? null : opt.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
                  statusFilter === opt.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban view — bleeds to right edge, gradient fade indicates scroll */}
      {view === "kanban" && (
        <div className="relative -mr-4 sm:-mr-6 lg:-mr-12">
          {orders.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">{emptyState}</p>
          ) : (
            <OrderKanban
              orders={filtered}
              showBrand={showBrand}
              statusOptions={statusOptions}
              selectMode={selectMode}
              selected={selected}
              onToggle={toggleSelect}
              showMoreLabel={bulkLabels?.kanbanShowMore}
            />
          )}
          {/* Right-edge gradient fade */}
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        orders.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">{emptyState}</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">{noResults}</p>
        ) : (
          <>
            <div className="space-y-2">
              {paginated.map((order) => (
                <OrderCardRow
                  key={order.id}
                  order={order}
                  showBrand={showBrand}
                  selectMode={selectMode}
                  selected={selected.has(order.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← {previousLabel}
                </Button>
                <span className="text-xs text-slate-500 tabular-nums">{paginationLabel}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {nextLabel} →
                </Button>
              </div>
            )}
          </>
        )
      )}

      {/* Floating action bar — always visible in select mode */}
      {selectMode && bulkLabels && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-xl">
          {/* Count / empty hint */}
          <span className="text-sm font-medium whitespace-nowrap">
            {selected.size === 0
              ? bulkLabels.selectMode
              : bulkLabels.selectedCount.replace("{n}", String(selected.size)).replace("{count}", String(selected.size))}
          </span>

          {selected.size > 0 && (
            <>
              <div className="w-px h-5 bg-slate-600 shrink-0" />

              {/* Status select */}
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                disabled={bulkActionState === "loading"}
                className="h-7 rounded-lg bg-slate-700 border border-slate-600 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">{bulkLabels.statusPlaceholder}</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Apply status */}
              <button
                onClick={handleApplyStatus}
                disabled={!bulkStatus || bulkActionState === "loading"}
                className="h-7 px-3 rounded-lg bg-white text-slate-900 text-xs font-medium disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                {bulkActionState === "loading" ? bulkLabels.applying : bulkLabels.applyStatus}
              </button>

              {/* Delivery button */}
              <button
                onClick={handleOpenDelivery}
                disabled={bulkActionState === "loading"}
                className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium disabled:opacity-40 hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                {bulkLabels.createDelivery}
              </button>

              {/* Feedback message */}
              {bulkMessage && (
                <span className={`text-xs whitespace-nowrap ${bulkActionState === "error" ? "text-red-300" : "text-emerald-300"}`}>
                  {bulkMessage}
                </span>
              )}
            </>
          )}

          {/* Close */}
          <button
            onClick={exitSelectMode}
            className="ml-1 flex items-center justify-center h-5 w-5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      )}

      {/* Delivery dialog */}
      {bulkLabels && (
        <Dialog open={deliveryOpen} onOpenChange={(open) => { if (!open) setDeliveryOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{bulkLabels.deliveryTitle}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{bulkLabels.deliveryAddress}</label>
                {deliveryAddressLoading ? (
                  <p className="text-sm text-slate-500">{bulkLabels.loadingAddresses}</p>
                ) : deliveryAddresses.length === 0 ? (
                  <p className="text-sm text-slate-500">{bulkLabels.noAddresses}</p>
                ) : (
                  <select
                    value={deliveryAddressId}
                    onChange={(e) => setDeliveryAddressId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {deliveryAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label} — {addr.company}, {addr.street}, {addr.postalCode} {addr.city}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{bulkLabels.deliveryNoteLabel}</label>
                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder={bulkLabels.deliveryNotePlaceholder}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                />
              </div>

              {/* Feedback */}
              {deliveryMessage && (
                <p className={`text-sm ${deliveryState === "error" ? "text-red-600" : "text-emerald-600"}`}>
                  {deliveryMessage}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeliveryOpen(false)}
                  disabled={deliveryState === "loading"}
                >
                  {bulkLabels.cancelSelect}
                </Button>
                <Button
                  onClick={handleCreateDelivery}
                  disabled={!deliveryAddressId || deliveryAddressLoading || deliveryState === "loading" || deliveryState === "success"}
                >
                  {deliveryState === "loading" ? bulkLabels.deliveryCreating : bulkLabels.deliveryCreate}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
