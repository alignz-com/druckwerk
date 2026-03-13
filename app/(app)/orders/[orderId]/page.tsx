import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAllowedQuantities } from "@/lib/order-quantities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderJdfRegenerateButton } from "@/components/orders/OrderJdfRegenerateButton";
import { OrderQuantityEditor } from "@/components/orders/OrderQuantityEditor";
import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";

type OrderDetailPageProps = {
  params: {
    orderId: string;
  };
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
    where: { id: params.orderId },
    include: {
      template: true,
      brand: true,
      user: { select: { name: true, email: true } },
      pdfOrderItems: { orderBy: { createdAt: "asc" } },
    },
  });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isPrinter = role === "PRINTER";
  const isBrandAdmin = role === "BRAND_ADMIN";
  const sameBrand = order?.brandId && session.user.brandId && order.brandId === session.user.brandId;
  const canView = order && (isAdmin || (isBrandAdmin && sameBrand) || order.userId === session.user.id);
  const canEditQuantity = Boolean(order) && (isAdmin || isPrinter);
  const canRegenerateJdf = isAdmin || isPrinter;
  if (!canView || !order) {
    notFound();
  }

  const meta = typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
  const templateKey = typeof meta.templateKey === "string" ? meta.templateKey : null;
  const addressMeta = (meta.address as AddressMeta | undefined) ?? undefined;
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : "";

  const statusLabel = t.statuses[order.status] ?? order.status;
  const deliveryTimeLabel =
    (order.deliveryTime in t.orderForm.deliveryTimes
      ? t.orderForm.deliveryTimes[order.deliveryTime as "express" | "standard"]
      : order.deliveryTime) ?? order.deliveryTime;
  const deliveryDueAtLabel = formatDeliveryDate(order.deliveryDueAt, locale);

  const addressLines = getAddressLines(addressMeta);
  const allowedQuantities = resolveAllowedQuantities(order?.brand ?? undefined);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">{t.ordersPage.detail.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{order.referenceCode}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(order.createdAt, locale)} • {order.template?.label ?? templateKey ?? order.templateId ?? "—"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Badge className="w-fit text-sm" variant="outline">
            {statusLabel}
          </Badge>
          <Button asChild variant="outline">
            <Link href="/orders">← {t.ordersPage.table.title}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t.ordersPage.detail.status}</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.brand}</dt>
              <dd className="mt-1 text-base text-slate-900">{order.brand?.name ?? "—"}</dd>
            </div>
            {order.type === "BUSINESS_CARD" && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.template}</dt>
                <dd className="mt-1 text-base text-slate-900">
                  {order.template?.label ?? templateKey ?? order.templateId ?? "—"}
                </dd>
              </div>
            )}
            {order.type === "BUSINESS_CARD" && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.quantity}</dt>
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
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.delivery}</dt>
              <dd className="mt-1 text-base text-slate-900">
                {deliveryTimeLabel}
                {deliveryDueAtLabel ? ` • ${deliveryDueAtLabel}` : ""}
              </dd>
            </div>
            {customerReference ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.customerReference}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-base text-slate-900">{customerReference}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t.ordersPage.detail.requester}</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.name}</dt>
              <dd className="mt-1 text-base text-slate-900">{order.requesterName}</dd>
            </div>
            {order.requesterRole ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.role}</dt>
                <dd className="mt-1 text-base text-slate-900">{order.requesterRole}</dd>
              </div>
            ) : null}
            {order.requesterSeniority ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.seniority}</dt>
                <dd className="mt-1 text-base text-slate-900">{order.requesterSeniority}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.email}</dt>
              <dd className="mt-1 text-base text-slate-900">{order.requesterEmail}</dd>
            </div>
            {order.phone ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.phone}</dt>
                <dd className="mt-1 text-base text-slate-900">{order.phone}</dd>
              </div>
            ) : null}
            {order.mobile ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.mobile}</dt>
                <dd className="mt-1 text-base text-slate-900">{order.mobile}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t.ordersPage.detail.company}</h2>
          <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{order.company ?? "—"}</p>

          <h3 className="mt-6 text-sm font-semibold text-slate-900">{t.ordersPage.detail.address}</h3>
          <div className="mt-2 text-sm text-slate-600">
            {addressLines.length ? addressLines.map((line, index) => <p key={index}>{line}</p>) : <p>—</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t.ordersPage.detail.contact}</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            {order.url ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.url}</dt>
                <dd className="mt-1 text-base text-blue-700">
                  <a href={order.url} target="_blank" rel="noopener noreferrer">
                    {order.url}
                  </a>
                </dd>
              </div>
            ) : null}
            {order.linkedin ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.linkedin}</dt>
                <dd className="mt-1 text-base text-blue-700">
                  <a href={order.linkedin} target="_blank" rel="noopener noreferrer">
                    {order.linkedin}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.table.reference}</dt>
              <dd className="mt-1 font-mono text-base text-slate-900">{order.referenceCode}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.table.created}</dt>
              <dd className="mt-1 text-base text-slate-900">{formatDate(order.createdAt, locale)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {order.pdfUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={order.pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </Button>
            ) : null}
            {order.jdfUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={order.jdfUrl} target="_blank" rel="noopener noreferrer">
                  JDF
                </a>
              </Button>
            ) : null}
            {canRegenerateJdf ? <OrderJdfRegenerateButton orderId={order.id} /> : null}
          </div>
        </section>
      </div>

      {/* PDF line items — only for PDF_PRINT orders */}
      {order.type === "PDF_PRINT" && order.pdfOrderItems.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Files</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Archive</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Format</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Bleed</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Colors</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Pages</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                </tr>
              </thead>
              <tbody>
                {order.pdfOrderItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium truncate max-w-[220px]">{item.filename}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[160px]">
                      {item.sourceZipFilename ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {item.trimWidthMm != null && item.trimHeightMm != null
                        ? `${item.trimWidthMm} × ${item.trimHeightMm} mm`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.bleedMm != null
                        ? item.bleedMm === 0
                          ? <span className="text-red-600">No bleed</span>
                          : `${item.bleedMm} mm`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.colorSpaces as string[]).map((cs) => (
                          <span key={cs} className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700">{cs}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{item.pages ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.notes && (
            <div className="mt-4 pt-4 border-t text-sm text-slate-600">
              <span className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Notes</span>
              {order.notes}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
