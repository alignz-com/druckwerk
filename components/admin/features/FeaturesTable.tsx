"use client";

import { useState, useMemo } from "react";
import { Search, Inbox, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import type { Feature, FeatureComment } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
  dataTableFooterClass,
} from "@/components/admin/shared/data-table-styles";

type FeatureWithComments = Feature & { comments: FeatureComment[] };

const STATUS_PILL: Record<string, string> = {
  IDEA:        "bg-purple-100 text-purple-700",
  PLANNED:     "bg-blue-100 text-blue-700",
  READY:       "bg-cyan-100 text-cyan-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  DONE:        "bg-emerald-100 text-emerald-700",
  PARKED:      "bg-slate-200 text-slate-600",
};

const PRIORITY_PILL: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-600",
  MEDIUM:   "bg-blue-100 text-blue-600",
  HIGH:     "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

type Props = {
  features: FeatureWithComments[];
  onSelect: (f: FeatureWithComments) => void;
  t: {
    table: {
      searchPlaceholder: string;
      empty: string;
      noResults: string;
      headers: Record<string, string>;
      pagination: {
        label: string;
        previous: string;
        next: string;
      };
    };
    status: Record<string, string>;
    priority: Record<string, string>;
    category: Record<string, string>;
  };
};

const PAGE_SIZE = 15;

export function FeaturesTable({ features, onSelect, t }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = features;
    if (statusFilter) {
      result = result.filter((f) => f.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) =>
        f.title.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [features, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageFeatures = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = filtered.length === 0 ? 0 : Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  const statuses = ["IDEA", "PLANNED", "READY", "IN_PROGRESS", "DONE", "PARKED"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={t.table.searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? null : s); setPage(0); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.status[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {features.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Inbox className="size-10 mb-2" />
          <p className="text-sm">{t.table.empty}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <SearchX className="size-10 mb-2" />
          <p className="text-sm">{t.table.noResults}</p>
        </div>
      ) : (
        <>
          <div className={dataTableContainerClass}>
            <table className="w-full text-sm">
              <thead>
                <tr className={dataTableHeaderClass}>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">{t.table.headers.title}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 hidden sm:table-cell">{t.table.headers.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 hidden sm:table-cell">{t.table.headers.priority}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">{t.table.headers.category}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">{t.table.headers.updated}</th>
                </tr>
              </thead>
              <tbody>
                {pageFeatures.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => onSelect(f)}
                    className={`${dataTableRowClass} cursor-pointer hover:bg-slate-50 transition-colors border-t`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{f.title}</span>
                      {f.comments.length > 0 && (
                        <span className="ml-2 text-[10px] text-slate-400">{f.comments.length} comments</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[f.status] ?? ""}`}>
                        {t.status[f.status] ?? f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_PILL[f.priority] ?? ""}`}>
                        {t.priority[f.priority] ?? f.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {t.category[f.category] ?? f.category}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                      {formatDistanceToNow(new Date(f.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={dataTableFooterClass}>
            <div>{t.table.pagination.label.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(filtered.length))}</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-9"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t.table.pagination.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || filtered.length === 0}
                className="h-9"
              >
                {t.table.pagination.next}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
