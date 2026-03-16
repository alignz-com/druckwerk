"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  deliveryDueAt: string | null; // ISO string
  canEdit: boolean;
  labels: {
    saved: string;
    error: string;
  };
};

export function OrderDeliveryDateEditor({ orderId, deliveryDueAt, canEdit, labels }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(deliveryDueAt ? deliveryDueAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const initial = deliveryDueAt ? deliveryDueAt.slice(0, 10) : "";
  const dirty = value !== initial;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDueAt: value ? new Date(value).toISOString() : null }),
      });
      if (!res.ok) throw new Error();
      setMessage({ text: labels.saved, ok: true });
      router.refresh();
    } catch {
      setMessage({ text: labels.error, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <span className="text-sm text-slate-900">{deliveryDueAt ? formatDate(deliveryDueAt) : "—"}</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => { setValue(e.target.value); setMessage(null); }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-slate-700 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        )}
      </div>
      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
