"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useTranslations } from "@/components/providers/locale-provider";

export type OrderCardData = {
  id: string;
  referenceCode: string;
  orderType: "TEMPLATE" | "UPLOAD";
  deliveryTime: string;
  brandName: string | null;
  brandId: string | null;
  templateLabel: string | null;    // BC: template.label (pill); PDF: joined product names
  productName: string | null;      // BC: localized product name from template.product
  thumbnailUrl: string | null;
  company: string | null;          // company on BC card; brand fallback for PDF
  requesterName: string | null;    // name ON the card (BC)
  requesterRole: string | null;    // position on the card (BC)
  requesterSeniority: string | null;
  orderedByName: string | null;    // user who placed the order
  quantity: number | null;         // BC: order.quantity; PDF: sum of item quantities
  fileCount: number | null;
  primaryFileName: string | null;  // PDF: first/only file name
  primaryPageCount: number | null; // PDF: first/only file page count
  productBreakdown: Array<{ name: string; quantity: number }> | null; // PDF: per-product qty
  totalPageCount: number | null;                                       // PDF: sum of all pages
  pageBreakdown: Array<{ product: string | null; format: string | null; pages: number }> | null;
  status: string;
  statusLabel: string;
  deliveryDueAtLabel: string | null;
  createdAtLabel: string;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT:              "bg-slate-100 text-slate-500",
  SUBMITTED:          "bg-blue-50 text-blue-700",
  IN_PRODUCTION:      "bg-amber-50 text-amber-700",
  READY_FOR_DELIVERY: "bg-emerald-50 text-emerald-700",
  COMPLETED:          "bg-slate-800 text-white",
  CANCELLED:          "bg-red-50 text-red-600",
};

function ThumbnailContent({ order }: { order: OrderCardData }) {
  const isBC = order.orderType === "TEMPLATE";

  const isMultiFile = (order.fileCount ?? 0) > 1;

  if (order.thumbnailUrl && !isMultiFile) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={order.thumbnailUrl}
        alt=""
        className="shadow-sm max-w-[48px] max-h-full w-auto h-auto"
      />
    );
  }

  if (isBC) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5">
        <div className="w-9 h-6 rounded border border-slate-300 bg-white shadow-sm" />
        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">BC</span>
      </div>
    );
  }

  const count = order.fileCount ?? 0;

  if (count <= 1) {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <FileText className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">PDF</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative w-8 h-10">
        <div className="absolute top-2 left-2.5 w-6 h-8 rounded-sm bg-slate-200 border border-slate-300" />
        <div className="absolute top-1 left-1.5 w-6 h-8 rounded-sm bg-slate-100 border border-slate-300" />
        <div className="absolute top-0 left-0 w-6 h-8 rounded-sm bg-white border border-slate-300 shadow-sm flex items-end justify-center pb-1">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide">PDF</span>
        </div>
      </div>
      <span className="absolute -bottom-0.5 -right-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-slate-500 text-white text-[9px] font-bold leading-none">
        {count}
      </span>
    </div>
  );
}

function Dot() {
  return <span className="text-slate-300 text-xs shrink-0">·</span>;
}

function PageBreakdownTooltip({ breakdown, children }: { breakdown: Array<{ product: string | null; format: string | null; pages: number }>; children: React.ReactNode }) {
  const t = useTranslations("pdfOrder");
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="cursor-pointer">{children}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className="z-50 rounded-lg bg-slate-900 px-3 py-2 drop-shadow-lg"
          >
            <div className="flex flex-col gap-1 min-w-[140px]">
              {breakdown.map(({ product, format, pages }, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-300">
                    {[product, format].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-xs text-white tabular-nums font-medium">{pages} {t("dropzonePagesAbbr")}</span>
                </div>
              ))}
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

type Line1Props = {
  order: OrderCardData;
  isBC: boolean;
  isMultiFile: boolean;
  qtyText: string | null;
};

function Line1({ order, isBC, isMultiFile, qtyText }: Line1Props) {
  const t = useTranslations("pdfOrder");
  // Build parts array so dots only appear between actual content
  if (isBC) {
    const parts: React.ReactNode[] = [];
    if (order.productName)
      parts.push(
        <span key="prod" className="text-sm font-semibold text-slate-900 shrink-0">
          {order.productName}
        </span>
      );
    if (order.brandName)
      parts.push(
        <span key="brand" className="shrink-0 inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500 leading-tight">
          {order.brandName}
        </span>
      );
    if (order.templateLabel)
      parts.push(
        <span key="tpl" className="shrink-0 inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500 leading-tight">
          {order.templateLabel}
        </span>
      );
    if (qtyText)
      parts.push(
        <span key="qty" className="text-xs text-slate-400 shrink-0">{qtyText}</span>
      );
    return (
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        {parts.map((p, i) => (
          <React.Fragment key={i}>{i > 0 && <Dot />}{p}</React.Fragment>
        ))}
      </div>
    );
  }

  // PDF
  const parts: React.ReactNode[] = [];
  if (isMultiFile && order.productBreakdown && order.productBreakdown.length > 0) {
    // Multi-file: show "2 × Broschüre · 6 × Leaflet"
    order.productBreakdown.forEach(({ name, quantity }, i) => {
      parts.push(
        <span key={`bd-${i}`} className="text-sm font-semibold text-slate-900 shrink-0">
          {quantity} × {name}
        </span>
      );
    });
    if (order.totalPageCount) {
      const label = `${order.totalPageCount} ${t("dropzoneColPages")}`;
      parts.push(
        order.pageBreakdown && order.pageBreakdown.length > 1
          ? <PageBreakdownTooltip key="pages" breakdown={order.pageBreakdown}>
              <span className="text-xs text-slate-400 shrink-0">{label}</span>
            </PageBreakdownTooltip>
          : <span key="pages" className="text-xs text-slate-400 shrink-0">{label}</span>
      );
    }
  } else {
    if (order.templateLabel)
      parts.push(
        <span key="label" className="text-sm font-semibold text-slate-900 shrink-0">
          {order.templateLabel}
        </span>
      );
    if (qtyText)
      parts.push(
        <span key="qty" className="text-xs text-slate-400 shrink-0">{qtyText}</span>
      );
    if (order.primaryPageCount != null)
      parts.push(
        <span key="pages" className="text-xs text-slate-400 shrink-0">{order.primaryPageCount} {t("dropzoneColPages")}</span>
      );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
      {parts.map((p, i) => (
        <React.Fragment key={i}>{i > 0 && <Dot />}{p}</React.Fragment>
      ))}
    </div>
  );
}

type Props = {
  order: OrderCardData;
  showBrand: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
};

export function OrderCardRow({ order, showBrand, selectMode = false, selected = false, onToggle }: Props) {
  const isBC = order.orderType === "TEMPLATE";
  const isExpress = order.deliveryTime === "express";
  const badgeClass = STATUS_STYLES[order.status] ?? STATUS_STYLES.DRAFT;
  const isMultiFile = (order.fileCount ?? 0) > 1;

  // Line 2: template orders show requester + role; upload orders show company · ordered by
  const line2 = isBC
    ? null // handled inline below for styling
    : [order.company ?? (showBrand ? order.brandName : null), order.orderedByName].filter(Boolean).join(" · ") || null;
  const bcLine2Name = isBC ? order.requesterName : null;
  const bcLine2Role = isBC ? [order.requesterRole, order.requesterSeniority].filter(Boolean).join(", ") || null : null;

  // Qty shown inline with product on line 1
  const qtyText = order.quantity ? `${order.quantity.toLocaleString()} Stk` : null;

  const dateLabel = order.deliveryDueAtLabel ?? order.createdAtLabel;

  const cardContent = (
    <>
      {/* Thumbnail panel */}
      <div className="relative w-[88px] h-[88px] shrink-0 self-center bg-slate-100 rounded-l-[inherit]">
        <div className="absolute inset-3 flex items-center justify-center">
          <ThumbnailContent order={order} />
        </div>
      </div>

      {/* Content — shifts right padding when in select mode to clear the badge */}
      <div className={`flex flex-1 min-w-0 items-stretch gap-3 px-4 py-3 transition-[padding-right] duration-200 ${selectMode ? "pr-9" : ""}`}>

        {/* Left: 3 lines */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">

          {/* Line 1: product · qty · file/page info · person (BC) */}
          <Line1 order={order} isBC={isBC} isMultiFile={isMultiFile} qtyText={qtyText} />

          {/* Line 2: requester (BC) or company · ordered by (upload) */}
          {(bcLine2Name || line2) && (
            <p className="text-xs text-slate-500 truncate">
              {bcLine2Name && <span className="font-medium text-slate-600">{bcLine2Name}</span>}
              {bcLine2Name && bcLine2Role && <span className="text-slate-400"> · {bcLine2Role}</span>}
              {line2}
            </p>
          )}

          {/* Line 3: reference code */}
          <p className="font-mono text-[11px] text-slate-400 tabular-nums">{order.referenceCode}</p>
        </div>

        {/* Right column: status / date+express */}
        <div className="flex flex-col items-end justify-between shrink-0 py-0.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badgeClass}`}>
            {order.statusLabel}
          </span>

          <div className="flex items-center gap-1">
            {isExpress && (
              <span className="text-[11px] font-semibold text-red-500 leading-none">Express</span>
            )}
            <span className={`text-[11px] tabular-nums whitespace-nowrap leading-none ${isExpress ? "text-red-500 font-semibold" : "text-slate-400"}`}>
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Arrow — hidden in select mode */}
        {!selectMode && (
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0 self-center" />
        )}
      </div>
    </>
  );

  if (selectMode) {
    return (
      <div
        onClick={() => onToggle?.(order.id)}
        className={`relative flex rounded-2xl border bg-white overflow-hidden cursor-pointer select-none transition-shadow ${
          selected
            ? "border-blue-500 shadow-md"
            : "border-slate-200 shadow-sm hover:shadow-md"
        }`}
      >
        {cardContent}
        {selected && (
          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm pointer-events-none z-10">
            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white stroke-2">
              <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/orders/${order.id}`}
      className="group flex rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
    >
      {cardContent}
    </Link>
  );
}
