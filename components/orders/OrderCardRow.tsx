"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type OrderCardData = {
  id: string;
  referenceCode: string;
  orderType: "BUSINESS_CARD" | "PDF_PRINT";
  deliveryTime: string;
  brandName: string | null;
  templateLabel: string | null;
  requesterName: string | null;
  requesterRole: string | null;
  requesterSeniority: string | null;
  quantity: number | null;
  fileCount: number | null;
  status: string;
  statusLabel: string;
  deliveryDueAtLabel: string | null;
  createdAtLabel: string;
};

const STATUS_STYLES: Record<string, { stripe: string; badge: string }> = {
  DRAFT:              { stripe: "bg-slate-300",   badge: "bg-slate-100 text-slate-500" },
  SUBMITTED:          { stripe: "bg-blue-400",    badge: "bg-blue-50 text-blue-700" },
  IN_PRODUCTION:      { stripe: "bg-amber-400",   badge: "bg-amber-50 text-amber-700" },
  READY_FOR_DELIVERY: { stripe: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700" },
  COMPLETED:          { stripe: "bg-slate-600",   badge: "bg-slate-800 text-white" },
  CANCELLED:          { stripe: "bg-red-300",     badge: "bg-red-50 text-red-600" },
};

type Props = {
  order: OrderCardData;
  showBrand: boolean;
};

export function OrderCardRow({ order, showBrand }: Props) {
  const isBC = order.orderType === "BUSINESS_CARD";
  const isExpress = order.deliveryTime === "express";
  const style = STATUS_STYLES[order.status] ?? STATUS_STYLES.DRAFT;

  // Headline: person name for BC, product/type label for PDF
  const headline = isBC
    ? [order.requesterName, order.requesterRole, order.requesterSeniority].filter(Boolean).join(" · ")
    : order.templateLabel ?? "PDF Print";

  // Sub-label: template for BC, brand for PDF (admin/printer)
  const subLabel = isBC
    ? order.templateLabel
    : showBrand ? order.brandName : null;

  // Brand shown only for BC admin/printer view
  const brandLine = isBC && showBrand ? order.brandName : null;

  const volumeText = isBC
    ? order.quantity ? `${order.quantity.toLocaleString()} cards` : null
    : order.fileCount ? `${order.fileCount} ${order.fileCount === 1 ? "file" : "files"}` : null;

  const dateLabel = order.deliveryDueAtLabel ?? order.createdAtLabel;

  return (
    <Link
      href={`/orders/${order.id}`}
      className="group flex rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
    >
      {/* Status stripe */}
      <div className={`w-[3px] rounded-l-2xl shrink-0 ${style.stripe}`} />

      {/* Content */}
      <div className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0 space-y-1">

          {/* Line 1: headline (person or product) + status badge */}
          <div className="flex items-start justify-between gap-3">
            <span className={`text-sm font-semibold leading-snug truncate ${!headline ? "text-slate-400 italic" : "text-slate-900"}`}>
              {headline || "—"}
            </span>
            <span className={`shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${style.badge}`}>
              {order.statusLabel}
            </span>
          </div>

          {/* Line 2: template (BC) or brand (PDF admin) */}
          {(subLabel || brandLine) && (
            <div className="flex items-center gap-2 min-w-0">
              {subLabel && (
                <span className="text-xs text-slate-500 truncate">{subLabel}</span>
              )}
              {brandLine && (
                <span className="text-xs text-slate-400 truncate">· {brandLine}</span>
              )}
              {!isBC && (
                <span className="shrink-0 inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-600">
                  PDF
                </span>
              )}
            </div>
          )}

          {/* Line 3: reference · volume · date */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
              {order.referenceCode}
            </span>
            {volumeText && (
              <>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">{volumeText}</span>
              </>
            )}
            <span className="flex-1" />
            {isExpress && (
              <span className="text-[11px] font-medium text-amber-600 shrink-0">Express</span>
            )}
            <span className={`text-[11px] tabular-nums shrink-0 ${isExpress ? "text-amber-600 font-medium" : "text-slate-400"}`}>
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
      </div>
    </Link>
  );
}
