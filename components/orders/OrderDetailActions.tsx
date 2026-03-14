"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { OrderJdfRegenerateButton } from "./OrderJdfRegenerateButton";

type Props = {
  orderId: string;
  currentStatus: string;
  statusOptions: { value: string; label: string }[];
  canChangeStatus: boolean;
  canDelete: boolean;
  canRegenerateJdf: boolean;
  labels: {
    changeStatus: string;
    applyStatus: string;
    statusUpdated: string;
    statusUpdateError: string;
    deleteAction: string;
    deleteRunning: string;
    deleteConfirm: string;
    deleteError: string;
  };
};

export function OrderDetailActions({
  orderId,
  currentStatus,
  statusOptions,
  canChangeStatus,
  canDelete,
  canRegenerateJdf,
  labels,
}: Props) {
  const router = useRouter();

  // Status change state
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Delete state
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleApplyStatus = async () => {
    if (isApplying) return;
    setIsApplying(true);
    setStatusMessage(null);
    setStatusError(null);
    try {
      const res = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId], status: selectedStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? labels.statusUpdateError);
      }
      setStatusMessage(labels.statusUpdated);
      router.refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : labels.statusUpdateError);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? labels.deleteError);
      }
      router.push("/orders");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : labels.deleteError);
      setIsDeleting(false);
      setDeleteConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      {canChangeStatus && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {labels.changeStatus}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyStatus}
              disabled={isApplying}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {labels.applyStatus}
            </button>
          </div>
          {statusMessage && <p className="text-xs text-emerald-600">{statusMessage}</p>}
          {statusError && <p className="text-xs text-red-600">{statusError}</p>}
        </div>
      )}

      {canRegenerateJdf && (
        <div>
          <OrderJdfRegenerateButton orderId={orderId} />
        </div>
      )}

      {canDelete && (
        <div className="space-y-1 pt-1 border-t border-slate-100">
          {!deleteConfirming ? (
            <button
              type="button"
              onClick={() => setDeleteConfirming(true)}
              className="text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              {labels.deleteAction}
            </button>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-slate-600">{labels.deleteConfirm}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? labels.deleteRunning : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirming(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  No
                </button>
              </div>
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
