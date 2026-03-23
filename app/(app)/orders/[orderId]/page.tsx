import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { getTemplateForBrandOrGlobal } from "@/lib/templates";
import { prisma } from "@/lib/prisma";
import { resolveAllowedQuantities } from "@/lib/order-quantities";
import { OrderQuantityEditor } from "@/components/orders/OrderQuantityEditor";
import { OrderDeliveryDateEditor } from "@/components/orders/OrderDeliveryDateEditor";
import { OrderDetailActionBar } from "@/components/orders/OrderDetailActionBar";
import { OrderCardPreview } from "@/components/orders/OrderCardPreview";
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

  const hasPdfItems = order.type === "UPLOAD" && order.pdfOrderItems.length > 1;
  const downloadPdfUrl = hasPdfItems
    ? `/api/orders/${orderId}/download-all?type=pdf`
    : order.type === "TEMPLATE" && order.pdfUrl
      ? order.pdfUrl
      : undefined;
  const downloadJdfUrl = hasPdfItems && (isAdmin || isPrinter)
    ? `/api/orders/${orderId}/download-all?type=jdf`
    : order.type === "TEMPLATE" && order.jdfUrl && (isAdmin || isPrinter)
      ? order.jdfUrl
      : undefined;

  const delivery = order.deliveryItems?.[0]?.delivery ?? null;
  const brandAddresses = order.brand?.addresses ?? [];

  const meta =
    typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
  const templateKey = typeof meta.templateKey === "string" ? meta.templateKey : null;

  // Load resolved template for SVG preview (template orders only)
  const resolvedTemplate = order.type === "TEMPLATE" && templateKey
    ? await getTemplateForBrandOrGlobal(templateKey, order.brandId)
    : null;
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : "";
  const publicProfileUrl =
    typeof meta.publicProfileUrl === "string" ? meta.publicProfileUrl : null;
  const qrMode = typeof meta.qrMode === "string" ? meta.qrMode : null;
  const addressMeta = meta.address && typeof meta.address === "object" ? meta.address as Record<string, string> : null;
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
      order.type === "UPLOAD"
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
    <div className="space-y-6 pb-24">
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
        </div>
      </div>

      {/* Main grid — 3 columns for template, 2 for upload */}
      <div className={`grid gap-6 ${order.type === "TEMPLATE" ? "lg:grid-cols-[3fr_1fr]" : "lg:grid-cols-[1fr_360px]"}`}>

        {/* TEMPLATE: Column 1 — Preview + Details / UPLOAD: Column 1 — Products */}
        <div className="space-y-6">
          {order.type === "TEMPLATE" ? (<>
            {/* Card SVG preview */}
            {resolvedTemplate ? (
              <OrderCardPreview
                template={resolvedTemplate}
                name={order.requesterName ?? ""}
                role={order.requesterRole ?? ""}
                seniority={order.requesterSeniority ?? ""}
                email={order.requesterEmail ?? ""}
                phone={order.phone ?? ""}
                mobile={order.mobile ?? ""}
                company={order.company ?? ""}
                url={order.url ?? ""}
                linkedin={order.linkedin ?? undefined}
                qrPreviewMode={qrMode === "public" ? "public" : "vcard"}
                qrPayload={publicProfileUrl}
                addressFields={addressMeta ? {
                  companyName: addressMeta.companyName,
                  street: addressMeta.street,
                  postalCode: addressMeta.postalCode,
                  city: addressMeta.city,
                  country: addressMeta.country,
                } : undefined}
                frontLabel={locale === "de" ? "Vorderseite" : "Front"}
                backLabel={locale === "de" ? "Rückseite" : "Back"}
              />
            ) : null}

            {/* Requester details */}
            <section className="rounded-lg border p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Details</h2>
              <dl className="divide-y divide-slate-100">
                {order.requesterName && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.name}</dt>
                    <dd className="text-sm text-slate-900 font-medium">{order.requesterName}</dd>
                  </div>
                )}
                {order.requesterRole && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.role}</dt>
                    <dd className="text-sm text-slate-900">{order.requesterRole}</dd>
                  </div>
                )}
                {order.requesterSeniority && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.seniority}</dt>
                    <dd className="text-sm text-slate-900">{order.requesterSeniority}</dd>
                  </div>
                )}
                {order.requesterEmail && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.email}</dt>
                    <dd className="text-sm text-slate-900">{order.requesterEmail}</dd>
                  </div>
                )}
                {order.phone && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.phone}</dt>
                    <dd className="text-sm text-slate-900">{order.phone}</dd>
                  </div>
                )}
                {order.mobile && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.mobile}</dt>
                    <dd className="text-sm text-slate-900">{order.mobile}</dd>
                  </div>
                )}
                {order.url && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.url}</dt>
                    <dd className="text-sm text-slate-900">
                      <a href={order.url} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-500">{order.url}</a>
                    </dd>
                  </div>
                )}
                {order.linkedin && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{t.ordersPage.detail.linkedin}</dt>
                    <dd className="text-sm text-slate-900">
                      <a href={order.linkedin} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-500 truncate block">{order.linkedin}</a>
                    </dd>
                  </div>
                )}
                {order.company && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{locale === "de" ? "Adresse" : "Address"}</dt>
                    <dd className="text-sm text-slate-900 whitespace-pre-line">{order.company}</dd>
                  </div>
                )}
                {publicProfileUrl && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">QR Link</dt>
                    <dd className="text-sm text-slate-900">
                      <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-500 truncate block">{publicProfileUrl}</a>
                    </dd>
                  </div>
                )}
                {order.photoOriginalUrl && (
                  <div className="flex items-start gap-4 py-2.5">
                    <dt className="w-16 shrink-0 text-xs text-slate-400 pt-0.5">{locale === "de" ? "Foto" : "Photo"}</dt>
                    <dd>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={order.photoOriginalUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </>) : (
            <OrderProductsTable
              type="UPLOAD"
              items={pdfItems}
              labels={tableLabels}
              orderId={order.id}
              canEditQty={canEditQuantity}
              canDownloadFiles={isAdmin || isPrinter}
            />
          )}

          {(customerReference || order.notes) && (
            <section className="rounded-lg border p-5">
              <dl className="space-y-3 text-sm">
                {customerReference && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.customerReference}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">{customerReference}</dd>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">{order.notes}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
              {order.type === "TEMPLATE" && bcProductName && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {locale === "de" ? "Produkt" : "Product"}
                  </dt>
                  <dd className="text-sm text-slate-900">{bcProductName}</dd>
                </div>
              )}
              {order.type === "TEMPLATE" && order.template && (
                <div className="flex items-start gap-4 py-2.5">
                  <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                    {locale === "de" ? "Vorlage" : "Template"}
                  </dt>
                  <dd className="text-sm text-slate-900">{order.template.label}</dd>
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
              {order.type === "TEMPLATE" && (
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
                        className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-500"
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
          downloadAllPdfs: hasPdfItems ? t.ordersPage.detail.downloadAllPdfs : t.ordersPage.detail.downloadPdf,
          downloadAllJdfs: hasPdfItems ? t.ordersPage.detail.downloadAllJdfs : t.ordersPage.detail.downloadJdf,
        }}
      />
    </div>
  );
}
