"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OrderCardData } from "./OrderCardRow";

const STATUS_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "IN_PRODUCTION",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
] as const;

const COLUMN_HEADER_STYLES: Record<string, string> = {
  DRAFT:              "bg-slate-200 text-slate-700",
  SUBMITTED:          "bg-blue-100 text-blue-800",
  IN_PRODUCTION:      "bg-amber-100 text-amber-800",
  READY_FOR_DELIVERY: "bg-emerald-100 text-emerald-800",
  COMPLETED:          "bg-slate-800 text-white",
  CANCELLED:          "bg-red-100 text-red-700",
};

const COLUMN_BODY_STYLES: Record<string, string> = {
  DRAFT:              "bg-slate-50",
  SUBMITTED:          "bg-blue-50/60",
  IN_PRODUCTION:      "bg-amber-50/60",
  READY_FOR_DELIVERY: "bg-emerald-50/60",
  COMPLETED:          "bg-slate-100/60",
  CANCELLED:          "bg-red-50/60",
};


const COLLAPSED_KEY = "orders-kanban-collapsed";
const COLUMN_LIMIT = 20;

type StatusOption = { value: string; label: string };

type Props = {
  orders: OrderCardData[];
  showBrand: boolean;
  statusOptions: StatusOption[];
  selectMode?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  showMoreLabel?: string;
};

// Compact kanban card — no thumbnail, no status badge
function KanbanCardContent({ order, showBrand, isSelected }: { order: OrderCardData; showBrand: boolean; isSelected?: boolean }) {
  const isExpress = order.deliveryTime === "express";
  const isBC = order.orderType === "BUSINESS_CARD";

  // Line 1: product · qty · pages/files
  const headlineParts = [
    order.productName ?? order.templateLabel,
    order.quantity ? `${order.quantity.toLocaleString()} Stk` : null,
    !isBC && (order.fileCount ?? 0) > 1
      ? `${order.fileCount} Dateien`
      : !isBC && order.primaryPageCount != null
        ? `${order.primaryPageCount} Seiten`
        : null,
  ].filter(Boolean);

  // Line 2: BC → name · role; PDF → company · brand
  const line2Parts = isBC
    ? [order.requesterName, order.requesterRole].filter(Boolean)
    : [order.company ?? (showBrand ? order.brandName : null), showBrand ? order.orderedByName : null].filter(Boolean);

  // Line 3: ref · date
  const dateLabel = order.deliveryDueAtLabel ?? order.createdAtLabel;
  return (
    <div className={`flex flex-col gap-1 px-3 py-2.5 bg-white rounded-xl border min-w-0 transition-shadow ${isSelected ? "border-blue-500 shadow-sm" : "border-slate-200 shadow-sm hover:shadow-md"}`}>
      {/* Line 1 */}
      <p className="text-sm font-semibold text-slate-900 truncate leading-snug">
        {headlineParts.join(" · ") || "–"}
      </p>

      {/* Template pill (BC only) */}
      {isBC && order.templateLabel && (
        <span className="inline-flex self-start items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500 leading-tight truncate max-w-full">
          {order.templateLabel}
        </span>
      )}

      {/* Line 2 */}
      {line2Parts.length > 0 && (
        <p className="text-xs text-slate-500 truncate">{line2Parts.join(" · ")}</p>
      )}

      {/* Line 3: ref · date · express */}
      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
        <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">{order.referenceCode}</span>
        <span className="text-slate-300 text-[10px] shrink-0">·</span>
        {isExpress && (
          <span className="text-[10px] font-semibold text-red-500 shrink-0">Express</span>
        )}
        <span className={`text-[10px] tabular-nums whitespace-nowrap shrink-0 ${isExpress ? "text-red-500 font-semibold" : "text-slate-400"}`}>
          {dateLabel}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({
  order,
  showBrand,
  selectMode,
  isSelected,
  onToggle,
}: {
  order: OrderCardData;
  showBrand: boolean;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { status: order.status },
    disabled: selectMode,
  });

  const content = <KanbanCardContent order={order} showBrand={showBrand} isSelected={isSelected} />;

  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle?.(order.id)}
        className={`w-full text-left transition-opacity ${isDragging ? "opacity-40" : ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing touch-none transition-opacity ${isDragging ? "opacity-40" : ""}`}
    >
      <Link href={`/orders/${order.id}`} tabIndex={-1} className="block">
        {content}
      </Link>
    </div>
  );
}

type ColumnProps = {
  status: string;
  label: string;
  orders: OrderCardData[];
  showBrand: boolean;
  collapsed: boolean;
  onToggle: () => void;
  isOver: boolean;
  selectMode?: boolean;
  selected?: Set<string>;
  onSelectToggle?: (id: string) => void;
  showMoreLabel?: string;
};

function KanbanColumnInner({ status, label, orders, showBrand, collapsed, onToggle, isOver, selectMode, selected, onSelectToggle, showMoreLabel }: ColumnProps) {
  const headerStyle = COLUMN_HEADER_STYLES[status] ?? "bg-slate-200 text-slate-700";
  const bodyStyle = COLUMN_BODY_STYLES[status] ?? "bg-slate-50";
  const [showAll, setShowAll] = useState(false);

  const visibleOrders = showAll ? orders : orders.slice(0, COLUMN_LIMIT);
  const hiddenCount = orders.length - COLUMN_LIMIT;

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className={`flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 px-2 py-3 min-w-10 h-full ${headerStyle}`}
      >
        <ChevronRight className="size-4 shrink-0" />
        <span className="text-xs font-bold tabular-nums">{orders.length}</span>
        <span className="text-xs font-semibold [writing-mode:vertical-lr] rotate-180">{label}</span>
      </button>
    );
  }

  return (
    <div className="relative h-full flex flex-col gap-0 rounded-2xl overflow-hidden border border-slate-200/80">
      {/* Drop target ring overlay — renders on top of header */}
      {isOver && <div className="absolute inset-0 rounded-2xl pointer-events-none z-10" style={{ boxShadow: "inset 0 0 0 2px rgba(59,130,246,0.4)" }} />}

      {/* Header */}
      <button type="button" onClick={onToggle} className={`flex items-center justify-between w-full px-3 py-2.5 hover:opacity-80 transition-opacity ${headerStyle}`}>
        <div className="flex items-center gap-1.5">
          <ChevronDown className="size-3.5" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-xs font-bold opacity-70 tabular-nums">{orders.length}</span>
      </button>

      {/* Cards area with tinted body */}
      <div className={`flex-1 flex flex-col gap-2 min-h-20 p-2 transition-colors ${isOver ? "bg-blue-50/40" : bodyStyle}`}>
        {visibleOrders.map((order) => (
          <DraggableCard
            key={order.id}
            order={order}
            showBrand={showBrand}
            selectMode={selectMode}
            isSelected={selected?.has(order.id)}
            onToggle={onSelectToggle}
          />
        ))}
        {!showAll && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-1 w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors text-center"
          >
            {(showMoreLabel ?? "Show {n} more").replace("{n}", String(hiddenCount))}
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanColumn(props: Omit<ColumnProps, "isOver">) {
  const { setNodeRef, isOver } = useDroppable({ id: props.status });
  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 self-stretch"
      style={{ width: props.collapsed ? "2.5rem" : "280px" }}
    >
      <KanbanColumnInner {...props} isOver={isOver} />
    </div>
  );
}

// Ghost card shown during drag
function GhostCard({ order, showBrand }: { order: OrderCardData; showBrand: boolean }) {
  return (
    <div className="w-[280px] rotate-1 shadow-2xl rounded-xl overflow-hidden">
      <KanbanCardContent order={order} showBrand={showBrand} />
    </div>
  );
}

export function OrderKanban({ orders, showBrand, statusOptions, selectMode, selected, onToggle, showMoreLabel }: Props) {
  const router = useRouter();

  const [localOrders, setLocalOrders] = useState<OrderCardData[]>(orders);
  useEffect(() => setLocalOrders(orders), [orders]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["DRAFT", "CANCELLED"]));
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

  const toggleCollapsed = useCallback((status: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeOrder = useMemo(
    () => localOrders.find((o) => o.id === activeId) ?? null,
    [localOrders, activeId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const labelMap = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.value, o.label])),
    [statusOptions],
  );

  const grouped = useMemo(() => {
    const map: Record<string, OrderCardData[]> = {};
    for (const s of STATUS_ORDER) map[s] = [];
    for (const order of localOrders) {
      if (map[order.status]) map[order.status].push(order);
      else map[order.status] = [order];
    }
    return map;
  }, [localOrders]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      const orderId = String(active.id);
      const newStatus = String(over.id);
      const order = localOrders.find((o) => o.id === orderId);
      if (!order || order.status === newStatus) return;

      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, statusLabel: labelMap[newStatus] ?? newStatus }
            : o,
        ),
      );

      try {
        const res = await fetch("/api/admin/orders/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: [orderId], status: newStatus }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: order.status, statusLabel: order.statusLabel }
              : o,
          ),
        );
      }
    },
    [localOrders, labelMap, router],
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 pr-16 items-stretch min-w-0">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            label={labelMap[status] ?? status}
            orders={grouped[status] ?? []}
            showBrand={showBrand}
            collapsed={collapsed.has(status)}
            onToggle={() => toggleCollapsed(status)}
            selectMode={selectMode}
            selected={selected}
            onSelectToggle={onToggle}
            showMoreLabel={showMoreLabel}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? (
          <GhostCard order={activeOrder} showBrand={showBrand} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
