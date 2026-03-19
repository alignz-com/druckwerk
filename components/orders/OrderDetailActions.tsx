"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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
            <LoadingButton variant="outline" onClick={handleApplyStatus} loading={isApplying} loadingText="…" minWidthClassName="min-w-[80px]">
              {labels.applyStatus}
            </LoadingButton>
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
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 px-0"
              onClick={() => setDeleteConfirming(true)}
            >
              {labels.deleteAction}
            </Button>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-slate-600">{labels.deleteConfirm}</p>
              <div className="flex items-center gap-3">
                <LoadingButton
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 px-0"
                  onClick={handleDelete}
                  loading={isDeleting}
                  loadingText={labels.deleteRunning}
                  minWidthClassName="min-w-[40px]"
                >
                  Yes
                </LoadingButton>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  onClick={() => setDeleteConfirming(false)}
                >
                  No
                </Button>
              </div>
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
