"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { XIcon } from "lucide-react";

type Address = { id: string; label: string | null; company: string | null; street: string | null; city: string | null };

type Props = {
  orderId: string;
  addresses: Address[];
  labels: {
    createConfirmation: string;
    confirmationCreated: string;
    confirmationCreateError: string;
    confirmationNoAddresses: string;
    confirmationNote: string;
    confirmationSelectAddress: string;
  };
};

function addressLine(a: Address) {
  return [a.label, a.company, a.street, a.city].filter(Boolean).join(", ");
}

export function OrderCreateConfirmationButton({ orderId, addresses, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: string; pdfUrl: string | null } | null>(null);

  async function handleCreate() {
    if (!addressId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/printer/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId], addressId, note: note || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? labels.confirmationCreateError);
      setResult({ number: data.delivery.number, pdfUrl: data.delivery.deliveryNoteUrl ?? null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.confirmationCreateError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(null); setError(null); }}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
      >
        {labels.createConfirmation}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.createConfirmation}</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-emerald-600">{labels.confirmationCreated}</p>
              <p className="text-sm font-medium text-slate-900">{result.number}</p>
              {result.pdfUrl && (
                <a
                  href={result.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  PDF
                </a>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="block text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">{labels.confirmationNoAddresses}</p>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {labels.confirmationSelectAddress}
                </label>
                <select
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {addressLine(a)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {labels.confirmationNote}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-lg border border-input px-3 text-sm text-slate-600 hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting || !addressId}
                  className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "…" : labels.createConfirmation}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
