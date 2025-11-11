import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    },
  });

  const isAdmin = session.user.role === "ADMIN";
  if (!order || (!isAdmin && order.userId !== session.user.id)) {
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">{t.ordersPage.detail.title}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{order.referenceCode}</h1>
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
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.template}</dt>
              <dd className="mt-1 text-base text-slate-900">
                {order.template?.label ?? templateKey ?? order.templateId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t.ordersPage.detail.quantity}</dt>
              <dd className="mt-1 text-base text-slate-900">{order.quantity.toLocaleString(locale)}</dd>
            </div>
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
                <dd className="mt-1 text-base text-slate-900">{customerReference}</dd>
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
          </div>
        </section>
      </div>
    </div>
  );
}
