import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAllowedQuantities } from "@/lib/order-quantities";
import { OrderQuantityEditor } from "@/components/orders/OrderQuantityEditor";
import { OrderDeliveryDateEditor } from "@/components/orders/OrderDeliveryDateEditor";
import { OrderDetailActionBar } from "@/components/orders/OrderDetailActionBar";
import {
  OrderProductsTable,
  type BcProductItem,
  type PdfProductItem,
  type OrderProductsTableLabels,
} from "@/components/orders/OrderProductsTable";
import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
  SUBMITTED: "bg-blue-50 text-blue-700",
  IN_PRODUCTION: "bg-amber-50 text-amber-700",
  READY_FOR_DELIVERY: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-slate-800 text-white",
  CANCELLED: "bg-red-50 text-red-600",
};

const STATUS_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "IN_PRODUCTION",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

const formatDate = (date: Date, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

const formatDeliveryDate = (date: Date | null, locale: Locale) => {
  if (!date) return null;
  return new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
  }).format(date);
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;

  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : "en";
  const t = getTranslations(locale);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      template: {
        include: {
          product: { select: { name: true, nameEn: true, nameDe: true } },
        },
      },
      brand: {
        include: {
          addresses: {
            select: { id: true, label: true, company: true, street: true, city: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      user: { select: { name: true, email: true } },
      pdfOrderItems: {
        orderBy: { createdAt: "asc" },
        include: {
          productFormat: { select: { product: { select: { name: true, nameEn: true, nameDe: true } }, format: { select: { name: true, nameDe: true } } } },
          jdfJob: { select: { jdfUrl: true, jdfFileName: true } },
        },
      },
      deliveryItems: {
        take: 1,
        include: {
          delivery: { select: { id: true, number: true, deliveryNoteUrl: true } },
        },
      },
    },
  });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isPrinter = role === "PRINTER";
  const isBrandAdmin = role === "BRAND_ADMIN";
  const sameBrand =
    order?.brandId && session.user.brandId && order.brandId === session.user.brandId;
  const canView =
    order && (isAdmin || (isBrandAdmin && sameBrand) || order.userId === session.user.id);

  if (!canView || !order) {
    notFound();
  }

  const canChangeStatus = isAdmin || isPrinter;
  const canEditQuantity = isAdmin || isPrinter;
  const canRegenerateJdf = isAdmin || isPrinter;
  const canDelete = (isAdmin || isPrinter) && order.status === "CANCELLED";
  const canCreateConfirmation =
    (isAdmin || isPrinter) && !order.deliveryItems?.length;

  const hasPdfItems = order.type === "PDF_PRINT" && order.pdfOrderItems.length > 1;
  const downloadPdfUrl = hasPdfItems ? `/api/orders/${orderId}/download-all?type=pdf` : undefined;
  const downloadJdfUrl = hasPdfItems && (isAdmin || isPrinter) ? `/api/orders/${orderId}/download-all?type=jdf` : undefined;

  const delivery = order.deliveryItems?.[0]?.delivery ?? null;
  const brandAddresses = order.brand?.addresses ?? [];

  const meta =
    typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
  const templateKey = typeof meta.templateKey === "string" ? meta.templateKey : null;
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : "";
  const isExpress = order.deliveryTime === "express";

  const statusLabel = t.statuses[order.status] ?? order.status;
  const deliveryTimeLabel =
    (order.deliveryTime in t.orderForm.deliveryTimes
      ? t.orderForm.deliveryTimes[order.deliveryTime as "express" | "standard"]
      : order.deliveryTime) ?? order.deliveryTime;
  const deliveryDueAtLabel = formatDeliveryDate(order.deliveryDueAt, locale);
  const createdAtLabel = formatDate(order.createdAt, locale);

  const allowedQuantities = resolveAllowedQuantities(order.brand ?? undefined);

  // Product name for BC orders
  const bcProductName =
    (locale === "de"
      ? order.template?.product?.nameDe
      : order.template?.product?.nameEn) ??
    order.template?.product?.name ??
    null;

  // Status options for selector
  const statusOptions = STATUS_ORDER.map((s) => ({
    value: s,
    label: (t.statuses as Record<string, string>)[s] ?? s,
  }));

  // PDF items
  const S3_BASE = `${process.env.S3_PUBLIC_URL ?? ""}/${process.env.S3_ORDERS_BUCKET ?? "orders"}`;
  const pdfItems: PdfProductItem[] = order.pdfOrderItems.map((item) => ({
    id: item.id,
    filename: item.filename,
    thumbnailUrl: item.thumbnailStoragePath ? `${S3_BASE}/${item.thumbnailStoragePath}` : null,
    pdfUrl: item.pdfUrl ?? (item.storagePath ? `${S3_BASE}/${item.storagePath}` : null),
    jdfUrl: item.jdfJob?.jdfUrl ?? null,
    jdfFileName: item.jdfJob?.jdfFileName ?? null,
    pages: item.pages ?? null,
    quantity: item.quantity,
    productName:
      (locale === "de" ? item.productFormat?.product?.nameDe : item.productFormat?.product?.nameEn) ??
      item.productFormat?.product?.name ??
      null,
    trimWidthMm: item.trimWidthMm ?? null,
    trimHeightMm: item.trimHeightMm ?? null,
    bleedMm: item.bleedMm ?? null,
    colorSpaces: (item.colorSpaces as string[]) ?? [],
    pantoneColors: (item.pantoneColors as string[]) ?? [],
    formatName: (locale === "de" ? item.productFormat?.format?.nameDe : null) ?? item.productFormat?.format?.name ?? null,
  }));

  // BC item for products table
  const bcItem: BcProductItem = {
    productName: bcProductName,
    templateLabel: order.template?.label ?? null,
    previewFrontPath: order.template?.previewFrontPath ?? null,
    quantity: order.quantity ?? 0,
    requesterName: order.requesterName ?? null,
    requesterRole: order.requesterRole ?? null,
    requesterSeniority: order.requesterSeniority ?? null,
    requesterEmail: order.requesterEmail ?? null,
    phone: order.phone ?? null,
    mobile: order.mobile ?? null,
    url: order.url ?? null,
    linkedin: order.linkedin ?? null,
    pdfUrl: order.pdfUrl ?? null,
    jdfUrl: order.jdfUrl ?? null,
  };

  const tableLabels: OrderProductsTableLabels = {
    product:
      order.type === "PDF_PRINT"
        ? locale === "de" ? "Produkt" : "Product"
        : t.ordersPage.detail.template,
    qty: t.ordersPage.detail.quantity,
    file: "File",
    format: "Format",
    pages: "Pages",
    bleed: t.ordersPage.detail.bleed,
    colors: "Colors",
    pantone: "Pantone",
    noBleed: t.ordersPage.detail.noBleed,
    name: t.ordersPage.detail.name,
    role: t.ordersPage.detail.role,
    seniority: t.ordersPage.detail.seniority,
    email: t.ordersPage.detail.email,
    phone: t.ordersPage.detail.phone,
    mobile: t.ordersPage.detail.mobile,
    url: t.ordersPage.detail.url,
    linkedin: t.ordersPage.detail.linkedin,
    details: t.ordersPage.detail.details,
    download: t.ordersPage.detail.downloadFile,
    open: t.ordersPage.detail.expandPreview,
  };

  return (
    <div className="overflow-x-auto">
    <div className="space-y-6 pb-24 min-w-[600px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/orders" className="hover:text-slate-600 transition-colors">
          {t.ordersPage.detail.backToOrders}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{order.referenceCode}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{order.referenceCode}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[order.status] ?? STATUS_STYLES.DRAFT}`}
            >
              {statusLabel}
            </span>
            {isExpress && (
              <span className="text-sm font-semibold text-red-500">Express</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {createdAtLabel}
            {order.brand?.name ? ` · ${order.brand.name}` : ""}
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Products */}
          {order.type === "PDF_PRINT" ? (
            <OrderProductsTable
              type="PDF_PRINT"
              items={pdfItems}
              labels={tableLabels}
              orderId={order.id}
              canEditQty={canEditQuantity}
              canDownloadFiles={isAdmin || isPrinter}
            />
          ) : (
            <OrderProductsTable
              type="BUSINESS_CARD"
              item={bcItem}
              labels={tableLabels}
            />
          )}

          {/* BC: notes + customer reference (if present) */}
          {(customerReference || order.notes) && (
            <section className="rounded-lg border p-5">
              <dl className="space-y-3 text-sm">
                {customerReference && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.customerReference}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">
                      {customerReference}
                    </dd>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">
                      {order.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Order metadata */}
          <section className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              {t.ordersPage.detail.orderInfo}
            </h2>
            <dl className="divide-y divide-slate-100">
              <div className="flex items-start gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                  {locale === "de" ? "Nummer" : "Number"}
                </dt>
                <dd className="text-sm text-slate-900 font-medium">{order.referenceCode}</dd>
              </div>
              <div className="flex items-start gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                  {locale === "de" ? "Datum" : "Date"}
                </dt>
                <dd className="text-sm text-slate-900">{createdAtLabel}</dd>
              </div>
              {order.brand?.name && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {locale === "de" ? "Firma" : "Company"}
                  </dt>
                  <dd className="text-sm text-slate-900">{order.brand.name}</dd>
                </div>
              )}
              {order.user && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {t.ordersPage.detail.contact}
                  </dt>
                  <dd className="text-sm text-slate-900">
                    <p>{order.user.name}</p>
                    <p className="text-xs text-slate-400">{order.user.email}</p>
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                  {t.ordersPage.detail.delivery}
                </dt>
                <dd className="text-sm text-slate-900">
                  {deliveryTimeLabel}
                </dd>
              </div>
              <div className="flex items-start gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                  {locale === "de" ? "Lieferdatum" : "Due date"}
                </dt>
                <dd className="text-sm text-slate-900">
                  <OrderDeliveryDateEditor
                    orderId={order.id}
                    deliveryDueAt={order.deliveryDueAt?.toISOString() ?? null}
                    canEdit={canEditQuantity}
                    labels={{
                      saved: t.ordersPage.detail.deliveryDateSaved,
                      error: t.ordersPage.detail.deliveryDateError,
                    }}
                  />
                </dd>
              </div>
              {/* BC: quantity editor */}
              {order.type === "BUSINESS_CARD" && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {t.ordersPage.detail.quantity}
                  </dt>
                  <dd className="text-sm text-slate-900">
                    <OrderQuantityEditor
                      orderId={order.id}
                      quantity={order.quantity ?? 0}
                      allowedQuantities={allowedQuantities}
                      canEdit={canEditQuantity}
                      locale={locale}
                    />
                  </dd>
                </div>
              )}
              {/* Confirmation link */}
              {delivery && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {t.ordersPage.detail.confirmation}
                  </dt>
                  <dd className="text-sm text-slate-900">
                    {delivery.deliveryNoteUrl ? (
                      <a
                        href={delivery.deliveryNoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {delivery.number}
                      </a>
                    ) : (
                      delivery.number
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>

        </div>
      </div>

      {/* Bottom action bar — admin/printer only */}
      <OrderDetailActionBar
        orderId={order.id}
        currentStatus={order.status}
        statusOptions={statusOptions}
        canChangeStatus={canChangeStatus}
        canRegenerateJdf={canRegenerateJdf}
        canDelete={canDelete}
        canCreateConfirmation={canCreateConfirmation}
        downloadPdfUrl={downloadPdfUrl}
        downloadJdfUrl={downloadJdfUrl}
        addresses={brandAddresses}
        labels={{
          changeStatus: t.ordersPage.detail.changeStatus,
          applyStatus: t.ordersPage.detail.applyStatus,
          statusUpdated: t.ordersPage.detail.statusUpdated,
          statusUpdateError: t.ordersPage.detail.statusUpdateError,
          deleteAction: t.ordersPage.detail.deleteAction,
          deleteRunning: t.ordersPage.detail.deleteRunning,
          deleteConfirm: t.ordersPage.detail.deleteConfirm,
          deleteError: t.ordersPage.detail.deleteError,
          jdfRebuild: t.ordersPage.detail.jdfRebuild,
          jdfRebuildRunning: t.ordersPage.detail.jdfRebuildRunning,
          jdfRebuildSuccess: t.ordersPage.detail.jdfRebuildSuccess,
          jdfRebuildError: t.ordersPage.detail.jdfRebuildError,
          createConfirmation: t.ordersPage.detail.createConfirmation,
          confirmationCreated: t.ordersPage.detail.confirmationCreated,
          confirmationCreateError: t.ordersPage.detail.confirmationCreateError,
          confirmationNoAddresses: t.ordersPage.detail.confirmationNoAddresses,
          confirmationNote: t.ordersPage.detail.confirmationNote,
          confirmationSelectAddress: t.ordersPage.detail.confirmationSelectAddress,
          downloadAllPdfs: t.ordersPage.detail.downloadAllPdfs,
          downloadAllJdfs: t.ordersPage.detail.downloadAllJdfs,
        }}
      />
    </div>
    </div>
  );
}
