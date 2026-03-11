"use client";

import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, RefreshCcw, Search } from "lucide-react";

import { dataTableContainerClass, dataTableHeaderClass, dataTableRowClass } from "@/components/admin/shared/data-table-styles";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export type DeliveryOrderRow = {
  orderId: string;
  referenceCode: string;
  templateLabel: string;
  brandName: string | null;
  quantity: number;
};

export type DeliveryRow = {
  id: string;
  number: string;
  createdAtLabel: string;
  createdAtValue: number;
  orderCount: number;
  note: string | null;
  deliveryNoteUrl: string | null;
  orders: DeliveryOrderRow[];
};

type Props = {
  deliveries: DeliveryRow[];
  labels: {
    searchPlaceholder: string;
    table: {
      number: string;
      created: string;
      orders: string;
      note: string;
      pdf: string;
      csv?: string;
      empty: string;
      noResults: string;
    };
    detail: {
      title: string;
      note: string;
      created: string;
      download: string;
      regenerate: string;
      downloadCsv?: string;
      orders: string;
      order: string;
      quantity: string;
      brand: string;
      template: string;
    };
  };
};

export function DeliveriesClient({ deliveries, labels }: Props) {
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedSearch) return deliveries;
    return deliveries.filter(
      (delivery) =>
        delivery.number.toLowerCase().includes(normalizedSearch) ||
        (delivery.note ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [deliveries, normalizedSearch]);

  const selected = detailId ? deliveries.find((item) => item.id === detailId) ?? null : null;

  const handleRegenerate = async () => {
    if (!selected) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/printer/deliveries/${selected.id}/print`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.open(data.url as string, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      <div className={dataTableContainerClass}>
        <Table>
          <TableHeader className={dataTableHeaderClass}>
            <TableRow>
              <TableHead className="w-52 whitespace-nowrap">{labels.table.number}</TableHead>
              <TableHead>{labels.table.created}</TableHead>
              <TableHead className="w-28">{labels.table.orders}</TableHead>
              <TableHead>{labels.table.note}</TableHead>
              <TableHead className="w-36 text-right">{labels.table.pdf}</TableHead>
              {labels.table.csv ? <TableHead className="w-28 text-right">{labels.table.csv}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className={dataTableRowClass}>
                <TableCell colSpan={labels.table.csv ? 6 : 5} className="text-center text-sm text-slate-500">
                  {deliveries.length === 0 ? labels.table.empty : labels.table.noResults}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((delivery) => (
                <TableRow
                  key={delivery.id}
                  className={dataTableRowClass}
                  onClick={() => setDetailId(delivery.id)}
                  role="button"
                >
                  <TableCell className="w-52 whitespace-nowrap font-medium text-slate-900">
                    {delivery.number}
                  </TableCell>
                  <TableCell>{delivery.createdAtLabel}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{delivery.orderCount}</Badge>
                  </TableCell>
                  <TableCell className="truncate text-slate-600">{delivery.note || "–"}</TableCell>
                  <TableCell className="text-right">
                    {delivery.deliveryNoteUrl ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={delivery.deliveryNoteUrl} target="_blank" rel="noreferrer">
                          <FileDown className="mr-2 h-4 w-4" />
                          PDF
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">–</span>
                    )}
                  </TableCell>
                  {labels.table.csv ? (
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost" disabled={!delivery.id}>
                        <a href={`/api/printer/deliveries/${delivery.id}/csv`} target="_blank" rel="noreferrer">
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          CSV
                        </a>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full max-w-2xl px-6 sm:px-8">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{labels.detail.title} #{selected.number}</SheetTitle>
                <SheetDescription>
                  {labels.detail.created}: {selected.createdAtLabel}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm" disabled={!selected.deliveryNoteUrl}>
                    <a
                      href={selected.deliveryNoteUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!selected.deliveryNoteUrl}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      {labels.detail.download}
                    </a>
                  </Button>
                  {labels.detail.downloadCsv ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/printer/deliveries/${selected.id}/csv`} target="_blank" rel="noreferrer">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        {labels.detail.downloadCsv}
                      </a>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {isRegenerating ? "…" : labels.detail.regenerate}
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {labels.detail.note}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {selected.note || "—"}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">{labels.detail.orders}</div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>{labels.detail.order}</TableHead>
                          <TableHead>{labels.detail.brand}</TableHead>
                          <TableHead>{labels.detail.template}</TableHead>
                          <TableHead className="w-20 text-right">{labels.detail.quantity}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.orders.map((item) => (
                          <TableRow key={item.orderId}>
                            <TableCell className="font-medium text-slate-900">{item.referenceCode}</TableCell>
                            <TableCell>{item.brandName ?? "—"}</TableCell>
                            <TableCell>{item.templateLabel}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
