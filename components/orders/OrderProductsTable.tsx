"use client";

import { useState } from "react";
import Image from "next/image";
import { FileTextIcon, Maximize2 } from "lucide-react";
// @ts-expect-error — no type declarations for pantone-table JSON
import pantoneTable from "pantone-table/dist/pantone-table.json";
function pantoneHex(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/^pantone\s+/, "pantone_").replace(/\s+/g, "_");
  return pantoneTable[key] ?? pantoneTable[`${key}_c`] ?? null;
}
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XIcon } from "lucide-react";

export type PdfProductItem = {
  id: string;
  filename: string;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  jdfUrl: string | null;
  jdfFileName: string | null;
  pages: number | null;
  quantity: number;
  productName: string | null;
  trimWidthMm: number | null;
  trimHeightMm: number | null;
  bleedMm: number | null;
  formatName: string | null;
  colorSpaces: string[];
  pantoneColors: string[];
};

export type BcProductItem = {
  productName: string | null;
  templateLabel: string | null;
  previewFrontPath: string | null;
  quantity: number;
  requesterName: string | null;
  requesterRole: string | null;
  requesterSeniority: string | null;
  requesterEmail: string | null;
  phone: string | null;
  mobile: string | null;
  url: string | null;
  linkedin: string | null;
  pdfUrl: string | null;
  jdfUrl: string | null;
};

export type OrderProductsTableLabels = {
  product: string;
  qty: string;
  file: string;
  format: string;
  pages: string;
  bleed: string;
  colors: string;
  pantone: string;
  noBleed: string;
  name: string;
  role: string;
  seniority: string;
  email: string;
  phone: string;
  mobile: string;
  url: string;
  linkedin: string;
  details: string;
  download: string;
  open: string;
};

type PdfProps = {
  type: "UPLOAD";
  items: PdfProductItem[];
  labels: OrderProductsTableLabels;
  orderId?: string;
  canEditQty?: boolean;
  canDownloadFiles?: boolean;
};

type BcProps = {
  type: "TEMPLATE";
  item: BcProductItem;
  labels: OrderProductsTableLabels;
};

type Props = PdfProps | BcProps;

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
      {children}
    </span>
  );
}

export function OrderProductsTable(props: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingFilename, setViewingFilename] = useState<string | null>(null);
  // Local qty overrides for optimistic inline editing
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const { labels } = props;

  if (props.type === "UPLOAD") {
    const selected = props.items[selectedIndex] ?? props.items[0];
    const { canEditQty, orderId, canDownloadFiles } = props;

    async function handleQtyChange(itemId: string, qty: number) {
      if (!orderId) return;
      setQtyOverrides((prev) => ({ ...prev, [itemId]: qty }));
      try {
        await fetch(`/api/orders/${orderId}/pdf-items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
      } catch {
        // revert on error
        setQtyOverrides((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
      }
    }

    return (
      <>
        {/* Fullscreen PDF viewer */}
        <Dialog
          open={!!viewingPdfUrl}
          onOpenChange={(open) => {
            if (!open) setViewingPdfUrl(null);
          }}
        >
          <DialogContent
            showClose={false}
            className="p-0 gap-0 overflow-hidden flex flex-col"
            style={{ width: "96vw", maxWidth: "96vw", height: "96vh" }}
          >
            <DialogHeader className="flex flex-row items-center gap-2 px-4 py-3 border-b shrink-0">
              <DialogTitle className="text-sm font-medium truncate flex-1">
                {viewingFilename}
              </DialogTitle>
              {viewingPdfUrl && (
                <a
                  href={viewingPdfUrl}
                  download
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {labels.download}
                </a>
              )}
              <DialogClose className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0">
                <XIcon className="h-4 w-4" />
              </DialogClose>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              {viewingPdfUrl && (
                <iframe
                  src={viewingPdfUrl}
                  className="w-full h-full border-0 block"
                  title={viewingFilename ?? "PDF"}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: table */}
          <div className="rounded-lg border overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1 min-h-[320px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {labels.product}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-10">
                      {labels.qty}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {labels.file}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {labels.format}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-14">
                      {labels.pages}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {props.items.map((item, i) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedIndex(i)}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${
                        i === selectedIndex ? "bg-muted" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {item.productName ?? "—"}
                      </td>
                      <td
                        className="px-3 py-3 text-right tabular-nums font-semibold text-xs"
                        onClick={(e) => canEditQty && e.stopPropagation()}
                      >
                        {canEditQty ? (
                          <input
                            type="number"
                            min={1}
                            value={qtyOverrides[item.id] ?? item.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value) || 1);
                              handleQtyChange(item.id, v);
                            }}
                            className="w-14 rounded border border-input bg-background px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        ) : (
                          qtyOverrides[item.id] ?? item.quantity
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-[160px]">
                        <p className="font-medium text-sm truncate">{item.filename}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {item.trimWidthMm != null && item.trimHeightMm != null ? (
                          <div className="flex flex-col">
                            {item.formatName && <span className="text-xs font-medium">{item.formatName}</span>}
                            <span className="font-mono text-[10px] text-muted-foreground">{item.trimWidthMm} × {item.trimHeightMm} mm</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {item.pages ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: detail panel */}
          {selected && (
            <div className="rounded-lg border p-5 flex flex-col gap-5">
              {/* Filename */}
              <p
                className="text-sm font-semibold text-foreground truncate leading-snug"
                title={selected.filename}
              >
                {selected.filename}
              </p>

              {/* Thumbnail */}
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={!selected.pdfUrl}
                  onClick={() => {
                    if (selected.pdfUrl) {
                      setViewingPdfUrl(selected.pdfUrl);
                      setViewingFilename(selected.filename);
                    }
                  }}
                  className="group relative rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center disabled:cursor-default"
                  style={{ width: "120px", height: "160px" }}
                >
                  {selected.thumbnailUrl ? (
                    <Image
                      src={selected.thumbnailUrl}
                      alt={selected.filename}
                      fill
                      className="object-contain p-2"
                      sizes="120px"
                    />
                  ) : (
                    <FileTextIcon className="h-8 w-8 text-muted-foreground/50" />
                  )}
                  {selected.pdfUrl && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 p-1.5 rounded-full shadow-sm">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                </button>
              </div>

              {/* Specs */}
              <div className="space-y-0 divide-y divide-border/60">
                <SpecRow label={labels.format}>
                  {selected.trimWidthMm != null && selected.trimHeightMm != null ? (
                    <>
                      {selected.formatName && <span className="text-xs font-medium">{selected.formatName}</span>}
                      <span className="font-mono text-[10px] text-muted-foreground">{selected.trimWidthMm} × {selected.trimHeightMm} mm</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </SpecRow>
                <SpecRow label={labels.bleed}>
                  {selected.bleedMm == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : selected.bleedMm === 0 ? (
                    <span className="text-xs text-destructive font-semibold">
                      {labels.noBleed}
                    </span>
                  ) : (
                    <span className="font-mono text-xs">{selected.bleedMm} mm</span>
                  )}
                </SpecRow>
                <SpecRow label={labels.pages}>
                  <span className="text-xs tabular-nums">{selected.pages ?? "—"}</span>
                </SpecRow>
                <SpecRow label={labels.colors}>
                  {selected.colorSpaces.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selected.colorSpaces.map((cs) => (
                        <Pill key={cs}>{cs}</Pill>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </SpecRow>
                {selected.pantoneColors.length > 0 && (
                  <SpecRow label={labels.pantone}>
                    <div className="flex flex-wrap gap-1">
                      {selected.pantoneColors.map((pc) => {
                        const hex = pantoneHex(pc);
                        return (
                          <Pill key={pc}>
                            {hex && (
                              <span className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: hex }} />
                            )}
                            {pc}
                          </Pill>
                        );
                      })}
                    </div>
                  </SpecRow>
                )}
                <SpecRow label={labels.qty}>
                  <span className="text-xs tabular-nums">{selected.quantity}</span>
                </SpecRow>
              </div>

            </div>
          )}
        </div>
      </>
    );
  }

  // TEMPLATE
  const { item } = props;
  const bcLabel = item.productName
    ? `${item.productName}${item.templateLabel ? ` — ${item.templateLabel}` : ""}`
    : (item.templateLabel ?? "—");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                {labels.product}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-10">
                {labels.qty}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-muted cursor-default">
              <td className="px-3 py-3 text-sm font-medium">{bcLabel}</td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold text-xs">
                {item.quantity}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Right: detail panel */}
      <div className="rounded-lg border p-5 flex flex-col gap-5">
        {/* Preview image */}
        {item.previewFrontPath && (
          <div className="flex justify-center">
            <div
              className="relative rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center"
              style={{ width: "120px", height: "160px" }}
            >
              <Image
                src={item.previewFrontPath}
                alt=""
                fill
                className="object-contain p-2"
                sizes="120px"
              />
            </div>
          </div>
        )}

        {/* Person details */}
        <div className="space-y-0 divide-y divide-border/60">
          {item.requesterName && (
            <SpecRow label={labels.name}>
              <span className="text-xs">{item.requesterName}</span>
            </SpecRow>
          )}
          {item.requesterRole && (
            <SpecRow label={labels.role}>
              <span className="text-xs">{item.requesterRole}</span>
            </SpecRow>
          )}
          {item.requesterSeniority && (
            <SpecRow label={labels.seniority}>
              <span className="text-xs">{item.requesterSeniority}</span>
            </SpecRow>
          )}
          {item.requesterEmail && (
            <SpecRow label={labels.email}>
              <span className="text-xs">{item.requesterEmail}</span>
            </SpecRow>
          )}
          {item.phone && (
            <SpecRow label={labels.phone}>
              <span className="text-xs">{item.phone}</span>
            </SpecRow>
          )}
          {item.mobile && (
            <SpecRow label={labels.mobile}>
              <span className="text-xs">{item.mobile}</span>
            </SpecRow>
          )}
          {item.url && (
            <SpecRow label={labels.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {item.url}
              </a>
            </SpecRow>
          )}
          {item.linkedin && (
            <SpecRow label={labels.linkedin}>
              <a
                href={item.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {item.linkedin}
              </a>
            </SpecRow>
          )}
        </div>

        {/* Download links */}
        {(item.pdfUrl || item.jdfUrl) && (
          <div className="flex flex-wrap gap-3 pt-1">
            {item.pdfUrl && (
              <a
                href={item.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                PDF
              </a>
            )}
            {item.jdfUrl && (
              <a
                href={item.jdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                JDF
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
