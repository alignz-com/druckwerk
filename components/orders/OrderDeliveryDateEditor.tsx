"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(
    deliveryDueAt ? new Date(deliveryDueAt) : undefined
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const initialIso = deliveryDueAt ? deliveryDueAt.slice(0, 10) : "";
  const selectedIso = selected ? toIsoDate(selected) : "";
  const dirty = selectedIso !== initialIso;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDueAt: selected ? selected.toISOString() : null }),
      });
      if (!res.ok) throw new Error();
      setMessage({ text: labels.saved, ok: true });
      setOpen(false);
      router.refresh();
    } catch {
      setMessage({ text: labels.error, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <span className="text-sm text-slate-900">
        {deliveryDueAt ? formatDate(deliveryDueAt) : "—"}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-slate-700 hover:bg-muted transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
            {selected ? formatDate(selected.toISOString()) : <span className="text-slate-400">—</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            initialFocus
          />
          <div className="border-t px-3 py-2 flex items-center justify-end gap-2">
            <div className="flex gap-2">
              {selected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500"
                  onClick={() => { setSelected(undefined); setMessage(null); }}
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!dirty || saving}
                onClick={handleSave}
              >
                {saving ? "…" : "Save"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {!open && message && (
        <p className={`text-xs ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
