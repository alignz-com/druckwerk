"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { FileText, X } from "lucide-react";

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

import {
  Dialog,
  DialogContent,
  DialogClose,
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
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async (url: string, filename: string) => {
    setDownloading(true);
    try { await triggerDownload(url, filename); } finally { setDownloading(false); }
  }, []);

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
                <Image
                  src={item.thumbnailUrl}
                  alt={item.filename}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 30vw, 150px"
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
        <DialogContent showClose={false} className="p-0 gap-0 overflow-hidden flex flex-col" style={{ width: "96vw", maxWidth: "96vw", height: "96vh" }}>
          <DialogHeader className="flex flex-row items-center gap-2 px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-medium truncate flex-1">{openItem?.filename}</DialogTitle>
            {openItem?.pdfUrl && (
              <button
                type="button"
                onClick={() => handleDownload(openItem.pdfUrl!, openItem.filename)}
                disabled={downloading}
                className="shrink-0 text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                {downloading ? "…" : downloadLabel}
              </button>
            )}
            <DialogClose className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {openItem?.pdfUrl && (
              <iframe
                src={openItem.pdfUrl}
                className="w-full h-full border-0 block"
                title={openItem.filename}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
