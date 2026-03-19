"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";

type Address = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  city: string | null;
};

type Props = {
  orderId: string;
  currentStatus: string;
  statusOptions: { value: string; label: string }[];
  canChangeStatus: boolean;
  canRegenerateJdf: boolean;
  canDelete: boolean;
  canCreateConfirmation: boolean;
  downloadPdfUrl?: string;
  downloadJdfUrl?: string;
  addresses: Address[];
  labels: {
    changeStatus: string;
    applyStatus: string;
    statusUpdated: string;
    statusUpdateError: string;
    deleteAction: string;
    deleteRunning: string;
    deleteConfirm: string;
    deleteError: string;
    jdfRebuild: string;
    jdfRebuildRunning: string;
    jdfRebuildSuccess: string;
    jdfRebuildError: string;
    createConfirmation: string;
    confirmationCreated: string;
    confirmationCreateError: string;
    confirmationNoAddresses: string;
    confirmationNote: string;
    confirmationSelectAddress: string;
    downloadAllPdfs: string;
    downloadAllJdfs: string;
  };
};

function addressLine(a: Address) {
  return [a.label, a.company, a.street, a.city].filter(Boolean).join(", ");
}

export function OrderDetailActionBar({
  orderId,
  currentStatus,
  statusOptions,
  canChangeStatus,
  canRegenerateJdf,
  canDelete,
  canCreateConfirmation,
  downloadPdfUrl,
  downloadJdfUrl,
  addresses,
  labels,
}: Props) {
  const router = useRouter();

  // Status
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [applyingStatus, setApplyingStatus] = useState(false);

  // JDF
  const [jdfBusy, setJdfBusy] = useState(false);

  // Confirmation dialog
  const [confOpen, setConfOpen] = useState(false);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [confNote, setConfNote] = useState("");
  const [confBusy, setConfBusy] = useState(false);
  const [confResult, setConfResult] = useState<{ number: string; pdfUrl: string | null } | null>(null);
  const [confError, setConfError] = useState<string | null>(null);

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Feedback message (status/jdf)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  function showFeedback(text: string, ok: boolean) {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleApplyStatus() {
    setApplyingStatus(true);
    try {
      const res = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId], status: selectedStatus }),
      });
      if (!res.ok) throw new Error();
      showFeedback(labels.statusUpdated, true);
      router.refresh();
    } catch {
      showFeedback(labels.statusUpdateError, false);
    } finally {
      setApplyingStatus(false);
    }
  }

  async function handleJdf() {
    setJdfBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/jdf`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? labels.jdfRebuildError);
      }
      showFeedback(labels.jdfRebuildSuccess, true);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : labels.jdfRebuildError, false);
    } finally {
      setJdfBusy(false);
    }
  }

  async function handleCreateConf() {
    if (!addressId) return;
    setConfBusy(true);
    setConfError(null);
    try {
      const res = await fetch("/api/printer/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId], addressId, note: confNote || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? labels.confirmationCreateError);
      setConfResult({ number: data.delivery.number, pdfUrl: data.delivery.deliveryNoteUrl ?? null });
      router.refresh();
    } catch (err) {
      setConfError(err instanceof Error ? err.message : labels.confirmationCreateError);
    } finally {
      setConfBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/orders");
    } catch {
      showFeedback(labels.deleteError, false);
      setDeleting(false);
    }
  }

  const hasActions = canChangeStatus || canRegenerateJdf || canCreateConfirmation || canDelete || !!downloadPdfUrl || !!downloadJdfUrl;
  if (!hasActions) return null;

  return (
    <>
      {/* Confirmation dialog */}
      <Dialog open={confOpen} onOpenChange={(o) => { setConfOpen(o); if (!o) { setConfResult(null); setConfError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.createConfirmation}</DialogTitle>
          </DialogHeader>
          {confResult ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-emerald-600">{labels.confirmationCreated}</p>
              <p className="text-sm font-medium">{confResult.number}</p>
              {confResult.pdfUrl && (
                <a href={confResult.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  PDF
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => setConfOpen(false)}>
                Close
              </Button>
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">{labels.confirmationNoAddresses}</p>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {labels.confirmationSelectAddress}
                </label>
                <select value={addressId} onChange={(e) => setAddressId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>{addressLine(a)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {labels.confirmationNote}
                </label>
                <textarea value={confNote} onChange={(e) => setConfNote(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {confError && <p className="text-xs text-red-600">{confError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfOpen(false)}>
                  Cancel
                </Button>
                <LoadingButton onClick={handleCreateConf} disabled={!addressId} loading={confBusy} loadingText="…" minWidthClassName="min-w-[140px]">
                  {labels.createConfirmation}
                </LoadingButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-xl">
        {/* Status */}
        {canChangeStatus && (
          <>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              disabled={applyingStatus}
              className="h-7 rounded-lg bg-slate-700 border border-slate-600 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleApplyStatus}
              disabled={applyingStatus || selectedStatus === currentStatus}
              className="h-7 px-3 rounded-lg bg-white text-slate-900 text-xs font-medium disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              {applyingStatus ? "…" : labels.applyStatus}
            </button>
            <div className="w-px h-5 bg-slate-600 shrink-0" />
          </>
        )}

        {/* JDF regenerate */}
        {canRegenerateJdf && (
          <button
            onClick={handleJdf}
            disabled={jdfBusy}
            className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium disabled:opacity-40 hover:bg-slate-600 transition-colors whitespace-nowrap"
          >
            {jdfBusy ? "…" : labels.jdfRebuild}
          </button>
        )}

        {/* Bulk downloads */}
        {(downloadPdfUrl || downloadJdfUrl) && (
          <>
            <div className="w-px h-5 bg-slate-600 shrink-0" />
            {downloadPdfUrl && (
              <a
                href={downloadPdfUrl}
                className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors whitespace-nowrap flex items-center"
              >
                {labels.downloadAllPdfs}
              </a>
            )}
            {downloadJdfUrl && (
              <a
                href={downloadJdfUrl}
                className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors whitespace-nowrap flex items-center"
              >
                {labels.downloadAllJdfs}
              </a>
            )}
          </>
        )}

        {/* Create confirmation */}
        {canCreateConfirmation && (
          <button
            onClick={() => { setConfOpen(true); setConfResult(null); setConfError(null); }}
            className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors whitespace-nowrap"
          >
            {labels.createConfirmation}
          </button>
        )}

        {/* Feedback */}
        {feedback && (
          <span className={`text-xs whitespace-nowrap ${feedback.ok ? "text-emerald-300" : "text-red-300"}`}>
            {feedback.text}
          </span>
        )}

        {/* Delete */}
        {canDelete && (
          <>
            <div className="w-px h-5 bg-slate-600 shrink-0" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-7 px-3 rounded-lg text-red-400 text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap">
                  {labels.deleteAction}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{labels.deleteConfirm}</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  >
                    {deleting ? labels.deleteRunning : "Yes"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </>
  );
}
