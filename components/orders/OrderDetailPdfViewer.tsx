"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PdfItem = {
  id: string;
  filename: string;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  pages: number | null;
  quantity: number;
  productName?: string | null;
};

type Props = {
  items: PdfItem[];
  expandLabel: string;
  downloadLabel: string;
  closeLabel: string;
};

export function OrderDetailPdfViewer({ items, expandLabel, downloadLabel }: Props) {
  const [openItem, setOpenItem] = useState<PdfItem | null>(null);

  return (
    <>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2">
            {/* Thumbnail */}
            <button
              type="button"
              onClick={() => item.pdfUrl && setOpenItem(item)}
              disabled={!item.pdfUrl}
              className="group relative w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-[3/4] flex items-center justify-center hover:border-slate-300 transition-colors disabled:cursor-default"
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.filename}
                  className="w-full h-full object-contain"
                />
              ) : (
                <FileText className="w-8 h-8 text-slate-400" />
              )}
              {item.pdfUrl && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 text-xs font-medium px-2.5 py-1 rounded-full shadow">
                    {expandLabel}
                  </span>
                </div>
              )}
            </button>

            {/* Info */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{item.filename}</p>
              {item.productName && (
                <p className="text-xs text-slate-400 truncate">{item.productName}</p>
              )}
              <p className="text-xs text-slate-500 tabular-nums">
                {[
                  item.pages != null ? `${item.pages}p` : null,
                  `×${item.quantity}`,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openItem != null} onOpenChange={(open) => { if (!open) setOpenItem(null); }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="truncate">{openItem?.filename}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {openItem?.pdfUrl && (
              <>
                <object
                  data={openItem.pdfUrl}
                  type="application/pdf"
                  className="w-full rounded-lg border border-slate-200"
                  style={{ minHeight: "600px" }}
                >
                  <div className="flex items-center justify-center h-40 text-sm text-slate-500">
                    PDF preview not supported.{" "}
                    <a
                      href={openItem.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:underline"
                    >
                      Open PDF
                    </a>
                  </div>
                </object>
                <div className="flex justify-end">
                  <a
                    href={openItem.pdfUrl}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {downloadLabel}
                  </a>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
