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
      <SheetContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-3xl">
        {order ? (
          <>
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
              <SheetHeader className="space-y-3 border-b-0 px-0 py-0">
                <SheetTitle className="text-xl font-semibold tracking-tight text-slate-900">
                  {labels.title}: {order.referenceCode}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <Badge variant="secondary">{order.statusLabel}</Badge>
                  <span>
                    {labels.brand}: {order.detail.brandName}
                  </span>
                  <span>•</span>
                  <span>
                    {labels.template}: {order.detail.templateLabel}
                  </span>
                  <span>•</span>
                  <span>
                    {labels.quantity}: {order.quantity.toLocaleString()}
                  </span>
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              <div className="space-y-10">
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{labels.previewTitle}</p>
                      <p className="text-xs text-slate-500">
                        {order.detail.deliveryDueAtLabel
                          ? `${labels.delivery}: ${order.deliveryTimeLabel} • ${order.detail.deliveryDueAtLabel}`
                          : `${labels.delivery}: ${order.deliveryTimeLabel}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant={activePreviewSide === "front" ? "default" : "outline"} size="sm" onClick={() => setActivePreviewSide("front")}>
                        Front
                      </Button>
                      <Button variant={activePreviewSide === "back" ? "default" : "outline"} size="sm" onClick={() => setActivePreviewSide("back")}>
                        Back
                      </Button>
                    </div>
                  </div>
                  <div className="relative aspect-[85/55] w-full">
                    {(!template || isLoadingTemplate) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-slate-500">
                        {templateError ?? labels.loadingTemplate}
                      </div>
                    )}
                    {template && (
                      <div className="h-full w-full">
                        {!previewReady && !templateError && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-xs text-slate-500">
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
                </section>

                <section className="border-t border-slate-200 pt-6">
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                    <Badge variant={order.deliveryTime === "express" ? "destructive" : "secondary"}>{order.deliveryTimeLabel}</Badge>
                    {order.detail.deliveryDueAtLabel ? <Badge variant="outline">{order.detail.deliveryDueAtLabel}</Badge> : null}
                    {order.detail.customerReference ? (
                      <Badge variant="outline">
                        {labels.customerReference}: {order.detail.customerReference}
                      </Badge>
                    ) : null}
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-8">
                  <div className="grid gap-10 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{labels.requester}</h3>
                        <p className="text-sm text-slate-500">{labels.contact}</p>
                      </div>
                      <div className="space-y-2">
                        <DetailItem label={labels.name} value={order.detail.requester.name} />
                        <DetailItem label={labels.role} value={order.detail.requester.role} />
                        <DetailItem label={labels.email} value={order.detail.requester.email} />
                        <DetailItem label={labels.phone} value={order.detail.requester.phone} />
                        <DetailItem label={labels.mobile} value={order.detail.requester.mobile} />
                        <DetailItem label={labels.linkedin} value={order.detail.requester.linkedin} />
                        <DetailItem label={labels.url} value={order.detail.requester.url} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{labels.company}</h3>
                        <p className="text-sm text-slate-500">{labels.address}</p>
                      </div>
                      <div className="space-y-2">
                        <DetailItem label={labels.companyName} value={primaryCompanyName} />
                        <pre className="whitespace-pre-wrap text-sm text-slate-700">{order.detail.company || "–"}</pre>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 text-right sm:px-8">
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
    <div className="text-sm text-slate-600">
      <span className="font-medium text-slate-900">{label}: </span>
      <span>{value}</span>
    </div>
  );
}
