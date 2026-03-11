"use client";

import { useState } from "react";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

export type OrderJdfRegenerateButtonProps = {
  orderId: string;
};

export function OrderJdfRegenerateButton({ orderId }: OrderJdfRegenerateButtonProps) {
  const t = useTranslations("ordersPage.detail");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/jdf`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("jdfRebuildError"));
      }
      setMessage(t("jdfRebuildSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jdfRebuildError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? t("jdfRebuildRunning") : t("jdfRebuild")}
      </Button>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
