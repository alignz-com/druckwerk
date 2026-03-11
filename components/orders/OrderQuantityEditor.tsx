"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrderQuantityEditorProps = {
  orderId: string;
  quantity: number;
  allowedQuantities: number[];
  canEdit: boolean;
  locale: string;
  onUpdated?: (quantity: number) => void;
};

export function OrderQuantityEditor({
  orderId,
  quantity,
  allowedQuantities,
  canEdit,
  locale,
  onUpdated,
}: OrderQuantityEditorProps) {
  const t = useTranslations("ordersPage.detail");
  const [current, setCurrent] = useState(String(quantity));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(String(quantity));
  }, [quantity]);

  if (!canEdit) {
    return <span>{Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(quantity)}</span>;
  }

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: Number(current) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("quantityUpdateError"));
      }
      onUpdated?.(Number(current));
      setSuccess(t("quantityUpdateSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quantityUpdateError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={current} onValueChange={setCurrent}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder={t("quantityEditPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {allowedQuantities.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value.toLocaleString(locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("quantityUpdating") : t("quantityUpdate")}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
    </div>
  );
}
