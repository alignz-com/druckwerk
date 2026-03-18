"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { Feature, FeatureComment } from "@prisma/client";

import { useLocale } from "@/components/providers/locale-provider";
import { messages } from "@/lib/i18n/messages";
import { FeatureKanban } from "./FeatureKanban";
import { FeaturesTable } from "./FeaturesTable";
import { FeatureDetailDialog } from "./FeatureDetailDialog";
import { FeatureCreateDialog } from "./FeatureCreateDialog";

type FeatureWithComments = Feature & { comments: FeatureComment[] };

type ViewMode = "kanban" | "list";

type Props = {
  features: FeatureWithComments[];
};

export default function AdminFeaturesClient({ features: initial }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const ft = messages[locale].admin.features;

  const [features, setFeatures] = useState(initial);
  const [view, setView] = useState<ViewMode>("kanban");
  const [selected, setSelected] = useState<FeatureWithComments | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
    fetch("/api/admin/features")
      .then((r) => r.json())
      .then((d) => { if (d.features) setFeatures(d.features); })
      .catch(() => {});
  }, [router]);

  const handleCreated = useCallback((f: FeatureWithComments) => {
    setFeatures((prev) => [f, ...prev]);
    setShowCreate(false);
    refresh();
  }, [refresh]);

  const handleUpdated = useCallback((f: FeatureWithComments) => {
    setFeatures((prev) => prev.map((x) => (x.id === f.id ? f : x)));
    setSelected(f);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setFeatures((prev) => prev.filter((x) => x.id !== id));
    setSelected(null);
    refresh();
  }, [refresh]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    // Optimistic update
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: status as Feature["status"] } : f,
      ),
    );
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const { feature } = await res.json();
      setFeatures((prev) => prev.map((f) => (f.id === id ? feature : f)));
    } catch {
      refresh();
    }
  }, [refresh]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ft.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{ft.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "kanban" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              {ft.views.kanban}
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "list" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <List className="size-3.5" />
              {ft.views.list}
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition"
          >
            <Plus className="size-4" />
            {ft.actions.new}
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <FeatureKanban
          features={features}
          onStatusChange={handleStatusChange}
          onSelect={setSelected}
          showMoreLabel={ft.kanban.showMore}
          statusLabels={ft.status}
        />
      ) : (
        <FeaturesTable
          features={features}
          onSelect={setSelected}
          t={ft}
        />
      )}

      {/* Detail dialog */}
      {selected && (
        <FeatureDetailDialog
          feature={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          t={ft}
        />
      )}

      {/* Create dialog */}
      {showCreate && (
        <FeatureCreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          t={ft}
        />
      )}
    </div>
  );
}
