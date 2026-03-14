import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAllowedQuantities } from "@/lib/order-quantities";
import { OrderJdfRegenerateButton } from "@/components/orders/OrderJdfRegenerateButton";
import { OrderQuantityEditor } from "@/components/orders/OrderQuantityEditor";
import { OrderDetailActions } from "@/components/orders/OrderDetailActions";
import { OrderDetailPdfViewer } from "@/components/orders/OrderDetailPdfViewer";
import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

type AddressMeta = {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  addressExtra?: string;
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

function getAddressLines(address?: AddressMeta | null) {
  if (!address) return [];
  return [
    address.companyName,
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
    address.country,
  ]
    .filter((line) => !!line && line.trim().length > 0)
    .map((line) => line!.trim());
}

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
      brand: true,
      user: { select: { name: true, email: true } },
      pdfOrderItems: {
        orderBy: { createdAt: "asc" },
        include: {
          product: { select: { name: true, nameEn: true, nameDe: true } },
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
  const canDelete = isAdmin && order.status === "CANCELLED";

  const meta =
    typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
  const templateKey = typeof meta.templateKey === "string" ? meta.templateKey : null;
  const addressMeta = (meta.address as AddressMeta | undefined) ?? undefined;
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

  const addressLines = getAddressLines(addressMeta);
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
  const pdfItems = order.pdfOrderItems.map((item) => ({
    id: item.id,
    filename: item.filename,
    thumbnailUrl: item.thumbnailStoragePath ? `${S3_BASE}/${item.thumbnailStoragePath}` : null,
    pdfUrl: item.storagePath ? `${S3_BASE}/${item.storagePath}` : null,
    pages: item.pages ?? null,
    quantity: item.quantity,
    productName:
      (locale === "de" ? item.product?.nameDe : item.product?.nameEn) ??
      item.product?.name ??
      null,
  }));

  return (
    <div className="space-y-6">
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
          {/* Order details card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <dl className="space-y-3 text-sm">
              {/* BC: template / product name */}
              {order.type === "BUSINESS_CARD" && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {t.ordersPage.detail.template}
                  </dt>
                  <dd className="mt-1 text-base text-slate-900">
                    {bcProductName
                      ? `${bcProductName}${order.template?.label ? ` — ${order.template.label}` : ""}`
                      : (order.template?.label ?? templateKey ?? order.templateId ?? "—")}
                  </dd>
                </div>
              )}

              {/* BC: quantity editor */}
              {order.type === "BUSINESS_CARD" && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {t.ordersPage.detail.quantity}
                  </dt>
                  <dd className="mt-1 text-base text-slate-900">
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

              {/* Delivery */}
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  {t.ordersPage.detail.delivery}
                </dt>
                <dd className="mt-1 text-base text-slate-900">
                  {deliveryTimeLabel}
                  {deliveryDueAtLabel ? ` · ${deliveryDueAtLabel}` : ""}
                </dd>
              </div>

              {/* Customer reference */}
              {customerReference ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">
                    {t.ordersPage.detail.customerReference}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">
                    {customerReference}
                  </dd>
                </div>
              ) : null}

              {/* Notes */}
              {order.notes ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">
                    {order.notes}
                  </dd>
                </div>
              ) : null}

              {/* Legacy PDF download link for BC orders */}
              {order.pdfUrl && order.type === "BUSINESS_CARD" ? (
                <div className="pt-2 flex flex-wrap gap-3">
                  <a
                    href={order.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    PDF
                  </a>
                  {order.jdfUrl ? (
                    <a
                      href={order.jdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      JDF
                    </a>
                  ) : null}
                </div>
              ) : null}
            </dl>
          </section>

          {/* PDF: large preview gallery */}
          {order.type === "PDF_PRINT" && pdfItems.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-4">
                {t.ordersPage.detail.previewTitle}
              </h2>
              <OrderDetailPdfViewer
                items={pdfItems}
                expandLabel={t.ordersPage.detail.expandPreview}
                downloadLabel={t.ordersPage.detail.downloadFile}
                closeLabel={t.ordersPage.detail.close}
              />
            </section>
          )}

          {/* PDF files table */}
          {order.type === "PDF_PRINT" && order.pdfOrderItems.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-4">
                {t.ordersPage.detail.filesSection}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        File
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Product
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Format
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Bleed
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Colors
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Pages
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.pdfOrderItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium truncate">{item.filename}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {item.product?.name ? (
                            (locale === "de" ? item.product.nameDe : item.product.nameEn) ??
                            item.product.name
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {item.trimWidthMm != null && item.trimHeightMm != null
                            ? `${item.trimWidthMm} × ${item.trimHeightMm} mm`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.bleedMm != null ? (
                            item.bleedMm === 0 ? (
                              <span className="text-red-600">
                                {t.ordersPage.detail.noBleed}
                              </span>
                            ) : (
                              `${item.bleedMm} mm`
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(item.colorSpaces as string[]).map((cs) => (
                              <span
                                key={cs}
                                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700"
                              >
                                {cs}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {item.pages ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Actions card — admin/printer only */}
          {(canChangeStatus || canDelete || canRegenerateJdf) && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">
                  {t.ordersPage.detail.actionsTitle}
                </h2>
                <OrderDetailActions
                  orderId={order.id}
                  currentStatus={order.status}
                  statusOptions={statusOptions}
                  canChangeStatus={canChangeStatus}
                  canDelete={canDelete}
                  canRegenerateJdf={canRegenerateJdf}
                  labels={{
                    changeStatus: t.ordersPage.detail.changeStatus,
                    applyStatus: t.ordersPage.detail.applyStatus,
                    statusUpdated: t.ordersPage.detail.statusUpdated,
                    statusUpdateError: t.ordersPage.detail.statusUpdateError,
                    deleteAction: t.ordersPage.detail.deleteAction,
                    deleteRunning: t.ordersPage.detail.deleteRunning,
                    deleteConfirm: t.ordersPage.detail.deleteConfirm,
                    deleteError: t.ordersPage.detail.deleteError,
                  }}
                />
              </div>
              {order.user && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                    {t.ordersPage.detail.orderedBy}
                  </p>
                  <p className="text-sm text-slate-700">{order.user.name}</p>
                  <p className="text-xs text-slate-400">{order.user.email}</p>
                </div>
              )}
            </section>
          )}

          {/* BC: template preview image */}
          {order.type === "BUSINESS_CARD" && order.template?.previewFrontPath && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
              <img
                src={order.template.previewFrontPath}
                alt=""
                className="w-full object-contain"
              />
            </section>
          )}

          {/* BC: Person details */}
          {order.type === "BUSINESS_CARD" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                {t.ordersPage.detail.requester}
              </h2>
              <dl className="space-y-3 text-sm">
                {order.requesterName && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.name}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.requesterName}</dd>
                  </div>
                )}
                {order.requesterRole ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.role}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.requesterRole}</dd>
                  </div>
                ) : null}
                {order.requesterSeniority ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.seniority}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.requesterSeniority}</dd>
                  </div>
                ) : null}
                {order.requesterEmail && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.email}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.requesterEmail}</dd>
                  </div>
                )}
                {order.phone ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.phone}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.phone}</dd>
                  </div>
                ) : null}
                {order.mobile ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.mobile}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">{order.mobile}</dd>
                  </div>
                ) : null}
                {order.url ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.url}
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={order.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {order.url}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {order.linkedin ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      {t.ordersPage.detail.linkedin}
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={order.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {order.linkedin}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          )}

          {/* Company */}
          {(order.company || addressLines.length > 0) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                {t.ordersPage.detail.company}
              </h2>
              {order.company && (
                <p className="text-sm text-slate-900 font-medium mb-2">{order.company}</p>
              )}
              {addressLines.length > 0 && (
                <div className="text-sm text-slate-600 space-y-0.5">
                  {addressLines.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
