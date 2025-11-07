"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPaperStockSummary } from "@/lib/admin/templates-data";
import { cn } from "@/lib/utils";

type PaperStockSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  className?: string;
};

type PaperStockFormState = {
  name: string;
  description: string;
  finish: string;
  color: string;
  weightGsm: string;
};

const emptyPaperForm: PaperStockFormState = {
  name: "",
  description: "",
  finish: "",
  color: "",
  weightGsm: "",
};

const NONE_VALUE = "__paper_stock_none__";

export function PaperStockSelector({ value, onChange, helperText, className }: PaperStockSelectorProps) {
  const t = useTranslations("admin.templates");
  const [stocks, setStocks] = useState<AdminPaperStockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paperForm, setPaperForm] = useState<PaperStockFormState>(emptyPaperForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const match = stocks.find((stock) => stock.id === value);
    if (!match) return "";
    const weight = match.weightGsm ? `${match.weightGsm}gsm` : "";
    const finish = match.finish ? `• ${match.finish}` : "";
    return [match.name, weight, finish].filter(Boolean).join(" ");
  }, [value, stocks]);

  const refreshStocks = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/paper-stocks");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed");
      }
      setStocks(Array.isArray(payload?.paperStocks) ? payload.paperStocks : []);
    } catch (error) {
      console.error("[admin] failed to load paper stocks", error);
      setLoadError(t("paperStock.errors.load"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshStocks();
  }, [refreshStocks]);

  const handleCreateStock: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setFormError(null);

    const name = paperForm.name.trim();
    if (!name) {
      setFormError(t("paperStock.errors.nameRequired"));
      return;
    }

    const payload = {
      name,
      description: paperForm.description.trim() || undefined,
      finish: paperForm.finish.trim() || undefined,
      color: paperForm.color.trim() || undefined,
      weightGsm: paperForm.weightGsm.trim() ? Number.parseInt(paperForm.weightGsm.trim(), 10) : undefined,
    };

    if (payload.weightGsm !== undefined && (!Number.isFinite(payload.weightGsm) || payload.weightGsm <= 0)) {
      setFormError(t("paperStock.errors.weightInvalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/paper-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? t("paperStock.errors.create"));
      }
      const newStock = data?.paperStock as AdminPaperStockSummary | undefined;
      if (newStock) {
        setStocks((current) => [...current, newStock].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(newStock.id);
      }
      setPaperForm(emptyPaperForm);
      setDialogOpen(false);
    } catch (error) {
      console.error("[admin] failed to create paper stock", error);
      setFormError(error instanceof Error ? error.message : t("paperStock.errors.create"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{t("paperStock.label")}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          disabled={isLoading}
          value={value || NONE_VALUE}
          onValueChange={(next) => {
            onChange(next === NONE_VALUE ? "" : next);
          }}
        >
          <SelectTrigger className="sm:min-w-[220px]">
            <SelectValue placeholder={isLoading ? t("paperStock.loading") : t("paperStock.placeholder")}>
              {value ? selectedLabel : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t("paperStock.none")}</SelectItem>
            {stocks.map((stock) => {
              const details = [];
              if (stock.weightGsm) details.push(`${stock.weightGsm}gsm`);
              if (stock.finish) details.push(stock.finish);
              return (
                <SelectItem key={stock.id} value={stock.id}>
                  <div className="flex flex-col">
                    <span>{stock.name}</span>
                    {details.length > 0 ? (
                      <span className="text-xs text-slate-500">{details.join(" • ")}</span>
                    ) : null}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
          {t("paperStock.addButton")}
        </Button>
      </div>
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("paperStock.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("paperStock.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paper-name">{t("paperStock.fields.name")}</Label>
              <Input
                id="paper-name"
                value={paperForm.name}
                onChange={(event) => setPaperForm((current) => ({ ...current, name: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paper-weight">{t("paperStock.fields.weight")}</Label>
                <Input
                  id="paper-weight"
                  type="number"
                  min={0}
                  value={paperForm.weightGsm}
                  onChange={(event) => setPaperForm((current) => ({ ...current, weightGsm: event.target.value }))}
                  placeholder="300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-finish">{t("paperStock.fields.finish")}</Label>
                <Input
                  id="paper-finish"
                  value={paperForm.finish}
                  onChange={(event) => setPaperForm((current) => ({ ...current, finish: event.target.value }))}
                  placeholder="Matte"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paper-color">{t("paperStock.fields.color")}</Label>
                <Input
                  id="paper-color"
                  value={paperForm.color}
                  onChange={(event) => setPaperForm((current) => ({ ...current, color: event.target.value }))}
                  placeholder="Bright white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-description">{t("paperStock.fields.description")}</Label>
                <Textarea
                  id="paper-description"
                  rows={3}
                  value={paperForm.description}
                  onChange={(event) => setPaperForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={t("paperStock.placeholders.description")}
                />
              </div>
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("paperStock.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {t("paperStock.actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
