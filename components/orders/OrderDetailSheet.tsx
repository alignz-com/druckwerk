import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FlipCard from "@/components/FlipCard";
import { BusinessCardBack, BusinessCardFront } from "@/components/PreviewCard";
import type { ResolvedTemplate } from "@/lib/templates";
import { OrderJdfRegenerateButton } from "@/components/orders/OrderJdfRegenerateButton";
import { useRouter } from "next/navigation";

import type { OrderDetailLabels, OrdersTableRow } from "./orders-table";
import { OrderQuantityEditor } from "@/components/orders/OrderQuantityEditor";

type OrderDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrdersTableRow | null;
  labels: OrderDetailLabels;
  canEditQuantity: boolean;
  canRegenerateJdf: boolean;
  locale: string;
};

export function OrderDetailSheet({
  open,
  onOpenChange,
  order,
  labels,
  canEditQuantity,
  canRegenerateJdf,
  locale,
}: OrderDetailSheetProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<ResolvedTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [activePreviewSide, setActivePreviewSide] = useState<"front" | "back">("front");
  const [frontReady, setFrontReady] = useState(false);
  const [backReady, setBackReady] = useState(false);
  const [currentQuantity, setCurrentQuantity] = useState<number>(order?.quantity ?? 0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canDelete = order?.status === "CANCELLED" && canEditQuantity;

  useEffect(() => {
    setCurrentQuantity(order?.quantity ?? 0);
  }, [order?.id, order?.quantity]);

  const handleDelete = async () => {
    if (!order) return;
    const confirmed = window.confirm(labels.deleteConfirm);
    if (!confirmed) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? labels.deleteError);
      }
      onOpenChange(false);
      router.replace("/orders?deleted=1");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : labels.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

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
  const cleanCustomerReference = useCallback((value?: string | null) => {
    if (!value) return "";
    return value.replace(/^Kundenreferenz:\s*/i, "").trim();
  }, []);

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
                  <StatusBadge status={order.status} text={order.statusLabel} />
                  <span>
                    {labels.brand}: {order.detail.brandName}
                  </span>
                  <span>•</span>
                  <span>
                    {labels.template}: {order.detail.templateLabel}
                  </span>
                  <span>•</span>
                  <span>
                    {labels.quantity}: {Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(currentQuantity)}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={activePreviewSide === "front" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActivePreviewSide("front")}
                      >
                        Front
                      </Button>
                      <Button
                        variant={activePreviewSide === "back" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActivePreviewSide("back")}
                      >
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
                                seniority={order.detail.requester.seniority}
                                email={order.detail.requester.email}
                                phone={order.detail.requester.phone}
                                mobile={order.detail.requester.mobile}
                                company={order.detail.company}
                                url={order.detail.requester.url}
                                linkedin={order.detail.requester.linkedin}
                                addressFields={addressFields}
                                onReadyChange={setFrontReady}
                                qrPreviewMode={order.detail.qrMode === "public" ? "public" : "vcard"}
                                qrPayload={order.detail.publicProfileUrl ?? null}
                              />
                            }
                            back={
                              <BusinessCardBack
                                template={template}
                                name={order.detail.requester.name}
                                role={order.detail.requester.role}
                                seniority={order.detail.requester.seniority}
                                email={order.detail.requester.email}
                                phone={order.detail.requester.phone}
                                mobile={order.detail.requester.mobile}
                                company={order.detail.company}
                                url={order.detail.requester.url}
                                linkedin={order.detail.requester.linkedin}
                                addressFields={addressFields}
                                onReadyChange={setBackReady}
                                qrPreviewMode={order.detail.qrMode === "public" ? "public" : "vcard"}
                                qrPayload={order.detail.publicProfileUrl ?? null}
                              />
                            }
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-8">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <KeyValue label={labels.brand} value={order.detail.brandName} />
                    <KeyValue label={labels.template} value={order.detail.templateLabel} />
                    <StatusValue label={labels.status} status={order.status} text={order.statusLabel} />
                    <KeyValue
                      label={labels.quantity}
                      value={
                        <OrderQuantityEditor
                          orderId={order.id}
                          quantity={currentQuantity}
                          allowedQuantities={order.allowedQuantities}
                          canEdit={canEditQuantity}
                          locale={locale}
                          onUpdated={setCurrentQuantity}
                        />
                      }
                    />
                    <KeyValue
                      label={labels.delivery}
                      value={
                        order.detail.deliveryDueAtLabel
                          ? `${order.deliveryTimeLabel} • ${order.detail.deliveryDueAtLabel}`
                          : order.deliveryTimeLabel
                      }
                    />
                    {order.detail.customerReference ? (
                      <KeyValue
                        label={labels.customerReference}
                        value={cleanCustomerReference(order.detail.customerReference)}
                        multiline
                      />
                    ) : null}
                  </div>
                  {deleteError ? <p className="mt-3 text-xs text-red-600">{deleteError}</p> : null}
                </section>

                <section className="border-t border-slate-200 pt-10">
                  <div className="grid gap-10 lg:grid-cols-2">
                    <div className="space-y-5">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-slate-900">{labels.requester}</h3>
                        <p className="text-sm text-slate-500">{labels.contact}</p>
                      </div>
                      <div className="grid gap-4">
                        <KeyValue label={labels.name} value={order.detail.requester.name} />
                        <KeyValue label={labels.role} value={order.detail.requester.role} />
                        {order.detail.requester.seniority ? (
                          <KeyValue label={labels.seniority} value={order.detail.requester.seniority} />
                        ) : null}
                        <KeyValue label={labels.email} value={order.detail.requester.email} />
                        <KeyValue label={labels.phone} value={order.detail.requester.phone} />
                        <KeyValue label={labels.mobile} value={order.detail.requester.mobile} />
                        <KeyValue label={labels.linkedin} value={order.detail.requester.linkedin} />
                        <KeyValue label={labels.url} value={order.detail.requester.url} />
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-slate-900">{labels.company}</h3>
                        <p className="text-sm text-slate-500">{labels.address}</p>
                      </div>
                      <div className="grid gap-4">
                        <KeyValue label={labels.companyName} value={primaryCompanyName} />
                        <KeyValue label={labels.company} value={order.detail.company} multiline />
                      </div>
                    </div>
                  </div>
                </section>

                {(canRegenerateJdf || canDelete) && (
                  <section className="border-t border-slate-200 pt-8">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">{labels.actionsTitle}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {canRegenerateJdf ? <OrderJdfRegenerateButton orderId={order.id} /> : null}
                        {canDelete ? (
                          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? labels.deleteRunning : labels.deleteAction}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                )}
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

function StatusValue({ label, status, text }: { label: string; status: string; text: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    DRAFT: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    SUBMITTED: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
    IN_PRODUCTION: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
    READY_FOR_DELIVERY: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
    COMPLETED: { bg: "bg-slate-300", text: "text-slate-900", border: "border-slate-400" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  };
  const color = colorMap[status] ?? colorMap.DRAFT;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${color.bg} ${color.text} ${color.border}`}
      >
        {text}
      </div>
    </div>
  );
}

function StatusBadge({ status, text }: { status: string; text: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    DRAFT: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    SUBMITTED: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
    IN_PRODUCTION: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
    READY_FOR_DELIVERY: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
    COMPLETED: { bg: "bg-slate-300", text: "text-slate-900", border: "border-slate-400" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  };
  const color = colorMap[status] ?? colorMap.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${color.bg} ${color.text} ${color.border}`}
    >
      {text}
    </span>
  );
}

function KeyValue({ label, value, multiline }: { label: string; value?: ReactNode; multiline?: boolean }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-medium text-slate-900 ${multiline ? "whitespace-pre-wrap break-words" : ""}`}>
        {value}
      </div>
    </div>
  );
}
