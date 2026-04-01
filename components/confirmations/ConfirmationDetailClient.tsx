"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, RefreshCcw } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type PdfItem = {
  filename: string;
  quantity: number;
  pages: number | null;
  productName: string | null;
  formatName: string | null;
};

type OrderRow = {
  orderId: string;
  referenceCode: string;
  type: "TEMPLATE" | "UPLOAD";
  brandName: string | null;
  templateLabel: string | null;
  productName: string | null;
  requesterName: string;
  requesterRole: string;
  quantity: number;
  deliveryTime: string;
  pdfItems: PdfItem[];
};

type Props = {
  confirmationId: string;
  deliveryNoteUrl: string | null;
  orders: OrderRow[];
  labels: {
    businessCards: string;
    printJobs: string;
    ref: string;
    qty: string;
    product: string;
    name: string;
    brandTemplate: string;
    file: string;
    format: string;
    pages: string;
    express: string;
    downloadPdf: string;
    downloadCsv: string;
    regenerate: string;
  };
};

export function ConfirmationDetailClient({ confirmationId, deliveryNoteUrl, orders, labels }: Props) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(deliveryNoteUrl);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/printer/deliveries/${confirmationId}/print`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        setPdfUrl(data.url);
        window.open(data.url as string, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const templateOrders = orders.filter((o) => o.type === "TEMPLATE");
  const uploadOrders = orders.filter((o) => o.type === "UPLOAD");

  return (
    <div className="space-y-8">
      {/* Business Cards table */}
      {templateOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{labels.businessCards}</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>{labels.ref}</TableHead>
                  <TableHead className="w-16">{labels.qty}</TableHead>
                  <TableHead>{labels.product}</TableHead>
                  <TableHead>{labels.name}</TableHead>
                  <TableHead>{labels.brandTemplate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templateOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="font-medium text-slate-900">
                      <div>{order.referenceCode}</div>
                      {order.deliveryTime === "express" && (
                        <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">
                          {labels.express}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.productName ?? "–"}</TableCell>
                    <TableCell>
                      <div>{order.requesterName}</div>
                      {order.requesterRole && (
                        <div className="text-xs text-slate-500">{order.requesterRole}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {[order.brandName, order.templateLabel].filter(Boolean).join(" / ") || "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Print Jobs table */}
      {uploadOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{labels.printJobs}</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>{labels.ref}</TableHead>
                  <TableHead className="w-16">{labels.qty}</TableHead>
                  <TableHead>{labels.product}</TableHead>
                  <TableHead>{labels.format}</TableHead>
                  <TableHead className="w-16">{labels.pages}</TableHead>
                  <TableHead>{labels.file}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadOrders.map((order) =>
                  order.pdfItems.length > 0 ? (
                    order.pdfItems.map((item, i) => (
                      <TableRow key={`${order.orderId}-${i}`}>
                        <TableCell className="font-medium text-slate-900">
                          {i === 0 && (
                            <>
                              <div>{order.referenceCode}</div>
                              {order.deliveryTime === "express" && (
                                <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">
                                  {labels.express}
                                </Badge>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.productName ?? "–"}</TableCell>
                        <TableCell>{item.formatName ?? "–"}</TableCell>
                        <TableCell>{item.pages ?? "–"}</TableCell>
                        <TableCell className="text-slate-600">{item.filename}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium text-slate-900">
                        <div>{order.referenceCode}</div>
                        {order.deliveryTime === "express" && (
                          <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">
                            {labels.express}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>{order.productName ?? "–"}</TableCell>
                      <TableCell>–</TableCell>
                      <TableCell>–</TableCell>
                      <TableCell>–</TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-xl">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <FileDown className="h-3.5 w-3.5" />
            {labels.downloadPdf}
          </a>
        )}
        <a
          href={`/api/printer/deliveries/${confirmationId}/csv`}
          target="_blank"
          rel="noreferrer"
          className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {labels.downloadCsv}
        </a>
        <div className="w-px h-5 bg-slate-600 shrink-0" />
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="h-7 px-3 rounded-lg bg-slate-700 text-white text-xs font-medium disabled:opacity-40 hover:bg-slate-600 transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
          {isRegenerating ? "…" : labels.regenerate}
        </button>
      </div>
    </div>
  );
}
