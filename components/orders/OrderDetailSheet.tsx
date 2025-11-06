import { useEffect, useMemo, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FlipCard from "@/components/FlipCard";
import { BusinessCardBack, BusinessCardFront } from "@/components/PreviewCard";
import type { ResolvedTemplate } from "@/lib/templates";

import type { OrderDetailLabels, OrdersTableRow } from "./orders-table";

type OrderDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrdersTableRow | null;
  labels: OrderDetailLabels;
};

export function OrderDetailSheet({ open, onOpenChange, order, labels }: OrderDetailSheetProps) {
  const [template, setTemplate] = useState<ResolvedTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [activePreviewSide, setActivePreviewSide] = useState<"front" | "back">("front");
  const [frontReady, setFrontReady] = useState(false);
  const [backReady, setBackReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setTemplate(null);
      setTemplateError(null);
      setFrontReady(false);
      setBackReady(false);
      return;
    }
    if (!order?.templateKey) {
      setTemplate(null);
      setTemplateError(labels.noTemplate);
      return;
    }
    const controller = new AbortController();
    const loadTemplate = async () => {
      try {
        setIsLoadingTemplate(true);
        setTemplateError(null);
        const params = new URLSearchParams();
        params.set("key", order.templateKey!);
        if (order.brandId) params.set("brandId", order.brandId);
        const res = await fetch(`/api/templates/resolve?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as { template: ResolvedTemplate };
        setTemplate(data.template);
      } catch (error: any) {
        if (controller.signal.aborted) return;
        setTemplateError(error?.message ?? "Failed to load template");
        setTemplate(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingTemplate(false);
          setFrontReady(false);
          setBackReady(false);
        }
      }
    };
    void loadTemplate();
    return () => controller.abort();
  }, [open, order?.templateKey, order?.brandId, labels.noTemplate]);

  const addressFields = useMemo(() => {
    const address = order?.detail.address;
    if (!address || typeof address !== "object") return undefined;
    return {
      companyName: typeof address.companyName === "string" ? address.companyName : undefined,
      street: typeof address.street === "string" ? address.street : undefined,
      postalCode: typeof address.postalCode === "string" ? address.postalCode : undefined,
      city: typeof address.city === "string" ? address.city : undefined,
      country: typeof address.country === "string" ? address.country : undefined,
    };
  }, [order]);

  const previewReady = frontReady && backReady;
  const companyLines = useMemo(() => {
    if (!order) return [];
    return (order.detail.company || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [order]);
  const primaryCompanyName = companyLines[0] ?? order?.detail.company ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {order ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {labels.title}: {order.referenceCode}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <Badge variant="secondary">{order.statusLabel}</Badge>
                <span>{labels.brand}: {order.detail.brandName}</span>
                <span>•</span>
                <span>{labels.template}: {order.detail.templateLabel}</span>
                <span>•</span>
                <span>{labels.quantity}: {order.quantity.toLocaleString()}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <Badge variant={order.deliveryTime === "express" ? "destructive" : "outline"}>
                  {labels.delivery}: {order.deliveryTimeLabel}
                </Badge>
                {order.detail.customerReference ? (
                  <Badge variant="outline">
                    {labels.customerReference}: {order.detail.customerReference}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{labels.requester}</h3>
                  <DetailItem label={labels.name} value={order.detail.requester.name} />
                  <DetailItem label={labels.role} value={order.detail.requester.role} />
                  <DetailItem label={labels.email} value={order.detail.requester.email} />
                  <DetailItem label={labels.phone} value={order.detail.requester.phone} />
                  <DetailItem label={labels.mobile} value={order.detail.requester.mobile} />
                  <DetailItem label={labels.linkedin} value={order.detail.requester.linkedin} />
                  <DetailItem label={labels.url} value={order.detail.requester.url} />
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{labels.company}</h3>
                  <DetailItem label={labels.companyName} value={primaryCompanyName} />
                  <h4 className="pt-2 text-sm font-medium text-slate-900">{labels.address}</h4>
                  <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{order.detail.company || "–"}</pre>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{labels.previewTitle}</h3>
                  <div className="flex gap-2">
                    <Button variant={activePreviewSide === "front" ? "default" : "outline"} size="sm" onClick={() => setActivePreviewSide("front")}>
                      Front
                    </Button>
                    <Button variant={activePreviewSide === "back" ? "default" : "outline"} size="sm" onClick={() => setActivePreviewSide("back")}>
                      Back
                    </Button>
                  </div>
                </div>
                <div className="relative aspect-[85/55] w-full rounded-2xl border border-slate-200 bg-white p-2">
                  {(!template || isLoadingTemplate) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 text-sm text-slate-500">
                      {templateError ?? labels.loadingTemplate}
                    </div>
                  )}
                  {template && (
                    <div className="h-full w-full">
                      {!previewReady && !templateError && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 text-xs text-slate-500">
                          {labels.loadingPreview}
                        </div>
                      )}
                      <div className={`h-full w-full transition-opacity duration-300 ${previewReady ? "opacity-100" : "opacity-0"}`}>
                        <FlipCard
                          activeSide={activePreviewSide}
                          front={
                            <BusinessCardFront
                              template={template}
                              name={order.detail.requester.name}
                              role={order.detail.requester.role}
                              email={order.detail.requester.email}
                              phone={order.detail.requester.phone}
                              mobile={order.detail.requester.mobile}
                              company={order.detail.company}
                              url={order.detail.requester.url}
                              linkedin={order.detail.requester.linkedin}
                              addressFields={addressFields}
                              onReadyChange={setFrontReady}
                            />
                          }
                          back={
                            <BusinessCardBack
                              template={template}
                              name={order.detail.requester.name}
                              role={order.detail.requester.role}
                              email={order.detail.requester.email}
                              phone={order.detail.requester.phone}
                              mobile={order.detail.requester.mobile}
                              company={order.detail.company}
                              url={order.detail.requester.url}
                              linkedin={order.detail.requester.linkedin}
                              addressFields={addressFields}
                              onReadyChange={setBackReady}
                            />
                          }
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 text-right">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {labels.close}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="text-xs text-slate-600">
      <span className="font-medium text-slate-900">{label}: </span>
      <span>{value}</span>
    </div>
  );
}
