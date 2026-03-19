"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Feature, FeatureComment } from "@prisma/client";

type FeatureWithComments = Feature & { comments: FeatureComment[] };

const STATUS_ORDER = ["IDEA", "PLANNED", "READY", "IN_PROGRESS", "DONE", "PARKED"] as const;

const COLUMN_HEADER_STYLES: Record<string, string> = {
  IDEA:        "bg-purple-100 text-purple-800",
  PLANNED:     "bg-blue-100 text-blue-800",
  READY:       "bg-cyan-100 text-cyan-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE:        "bg-emerald-100 text-emerald-800",
  PARKED:      "bg-slate-200 text-slate-600",
};

const COLUMN_BODY_STYLES: Record<string, string> = {
  IDEA:        "bg-purple-50/40",
  PLANNED:     "bg-blue-50/40",
  READY:       "bg-cyan-50/40",
  IN_PROGRESS: "bg-amber-50/40",
  DONE:        "bg-emerald-50/40",
  PARKED:      "bg-slate-50",
};

const PRIORITY_DOT: Record<string, string> = {
  LOW:      "bg-slate-300",
  MEDIUM:   "bg-blue-400",
  HIGH:     "bg-amber-500",
  CRITICAL: "bg-red-500",
};

const CATEGORY_COLORS: Record<string, string> = {
  UI:             "bg-indigo-100 text-indigo-700",
  UX:             "bg-purple-100 text-purple-700",
  BACKEND:        "bg-emerald-100 text-emerald-700",
  INFRASTRUCTURE: "bg-orange-100 text-orange-700",
  BUG:            "bg-red-100 text-red-700",
};

type Props = {
  features: FeatureWithComments[];
  onStatusChange: (id: string, status: string) => void;
  onSelect: (feature: FeatureWithComments) => void;
  onAddInStatus?: (status: string) => void;
  showMoreLabel: string;
  statusLabels: Record<string, string>;
};

function FeatureCard({ feature, onSelect }: { feature: FeatureWithComments; onSelect: (f: FeatureWithComments) => void }) {
  const priorityDot = PRIORITY_DOT[feature.priority] ?? "bg-slate-300";
  const catStyle = CATEGORY_COLORS[feature.category] ?? "bg-slate-100 text-slate-600";
  const commentCount = feature.comments.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(feature)}
      className="w-full text-left flex flex-col gap-1.5 px-3 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 min-w-0">
        <span className={`mt-1.5 size-2 rounded-full shrink-0 ${priorityDot}`} />
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{feature.title}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium ${catStyle}`}>
          {feature.category}
        </span>
        {feature.section && (
          <span className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium bg-slate-100 text-slate-600">
            {feature.section}
          </span>
        )}
        {commentCount > 0 && (
          <span className="text-[10px] text-slate-400">{commentCount} comment{commentCount !== 1 ? "s" : ""}</span>
        )}
      </div>
    </button>
  );
}

function DraggableCard({ feature, onSelect }: { feature: FeatureWithComments; onSelect: (f: FeatureWithComments) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
    data: { status: feature.status },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing touch-none transition-opacity ${isDragging ? "opacity-40" : ""}`}
    >
      <FeatureCard feature={feature} onSelect={onSelect} />
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  features,
  onSelect,
  isOver,
  showMoreLabel,
  collapsed,
  onToggleCollapse,
  onAdd,
}: {
  status: string;
  label: string;
  features: FeatureWithComments[];
  onSelect: (f: FeatureWithComments) => void;
  isOver: boolean;
  showMoreLabel: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAdd?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const headerStyle = COLUMN_HEADER_STYLES[status] ?? "bg-slate-200 text-slate-700";
  const bodyStyle = COLUMN_BODY_STYLES[status] ?? "bg-slate-50";
  const COLUMN_LIMIT = 10;
  const visible = showAll ? features : features.slice(0, COLUMN_LIMIT);
  const hidden = features.length - COLUMN_LIMIT;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className={`flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 px-2 py-3 min-w-10 h-full ${headerStyle}`}
      >
        <ChevronRight className="size-4 shrink-0" />
        <span className="text-xs font-bold tabular-nums">{features.length}</span>
        <span className="text-xs font-semibold [writing-mode:vertical-lr] rotate-180">{label}</span>
      </button>
    );
  }

  return (
    <div className="relative h-full flex flex-col gap-0 rounded-2xl overflow-hidden border border-slate-200/80">
      {isOver && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-10" style={{ boxShadow: "inset 0 0 0 2px rgba(59,130,246,0.4)" }} />
      )}
      <div className={`flex items-center justify-between px-3 py-2.5 ${headerStyle}`}>
        <button type="button" onClick={onToggleCollapse} className="flex-1 flex items-center gap-1.5 hover:opacity-70 transition-opacity">
          <ChevronDown className="size-3.5" />
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs font-bold opacity-70 tabular-nums ml-auto">{features.length}</span>
        </button>
        {onAdd && (
          <button type="button" onClick={onAdd} className="rounded-md p-0.5 hover:opacity-70 transition-opacity ml-1.5">
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      <div className={`flex-1 flex flex-col gap-2 min-h-20 p-2 overflow-y-auto transition-colors ${isOver ? "bg-blue-50/40" : bodyStyle}`}>
        {visible.map((f) => (
          <DraggableCard key={f.id} feature={f} onSelect={onSelect} />
        ))}
        {!showAll && hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-1 w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors text-center"
          >
            {showMoreLabel.replace("{n}", String(hidden))}
          </button>
        )}
      </div>
    </div>
  );
}

function DroppableColumn(props: Omit<Parameters<typeof KanbanColumn>[0], "isOver">) {
  const { setNodeRef, isOver } = useDroppable({ id: props.status });
  return (
    <div ref={setNodeRef} className="flex-shrink-0 self-stretch" style={props.collapsed ? undefined : { width: "260px" }}>
      <KanbanColumn {...props} isOver={isOver} />
    </div>
  );
}

const COLLAPSED_KEY = "feature-kanban-collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function FeatureKanban({ features, onStatusChange, onSelect, onAddInStatus, showMoreLabel, statusLabels }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { setCollapsed(loadCollapsed()); }, []);

  const toggleCollapse = useCallback((status: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [status]: !prev[status] };
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<string, FeatureWithComments[]> = {};
    for (const s of STATUS_ORDER) map[s] = [];
    for (const f of features) {
      if (map[f.status]) map[f.status].push(f);
      else map[f.status] = [f];
    }
    return map;
  }, [features]);

  const activeFeature = useMemo(
    () => features.find((f) => f.id === activeId) ?? null,
    [features, activeId],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const featureId = String(active.id);
    const newStatus = String(over.id);
    const feature = features.find((f) => f.id === featureId);
    if (!feature || feature.status === newStatus) return;
    onStatusChange(featureId, newStatus);
  }, [features, onStatusChange]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 pr-16 items-stretch min-w-0 h-[calc(100vh-12rem)]">
        {STATUS_ORDER.map((status) => (
          <DroppableColumn
            key={status}
            status={status}
            label={statusLabels[status] ?? status}
            features={grouped[status] ?? []}
            onSelect={onSelect}
            showMoreLabel={showMoreLabel}
            collapsed={!!collapsed[status]}
            onToggleCollapse={() => toggleCollapse(status)}
            onAdd={onAddInStatus ? () => onAddInStatus(status) : undefined}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFeature ? (
          <div className="w-[260px] rotate-1 shadow-2xl rounded-xl overflow-hidden">
            <FeatureCard feature={activeFeature} onSelect={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
