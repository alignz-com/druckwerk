import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { DeliveriesClient, type DeliveryRow } from "@/components/deliveries/DeliveriesClient";

export default async function DeliveriesPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") {
    redirect("/orders");
  }

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : "en";
  const localeTag = locale === "de" ? "de-AT" : "en-GB";
  const t = getTranslations(locale);

  const deliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          order: {
            include: {
              brand: { select: { name: true } },
              template: { select: { label: true, key: true } },
            },
          },
        },
      },
    },
  });

  const rows: DeliveryRow[] = deliveries.map((delivery) => ({
    id: delivery.id,
    number: delivery.number,
    createdAtLabel: formatDateTime(delivery.createdAt, localeTag, { dateStyle: "medium" }),
    createdAtValue: delivery.createdAt.getTime(),
    orderCount: delivery.items.length,
    note: delivery.note ?? null,
    deliveryNoteUrl: delivery.deliveryNoteUrl ?? null,
    orders: delivery.items.map((item) => ({
      orderId: item.orderId,
      referenceCode: item.order.referenceCode,
      brandName: item.order.brand?.name ?? null,
      templateLabel: item.order.template?.label ?? item.order.template?.key ?? "—",
      quantity: item.order.quantity ?? 0,
    })),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.deliveriesPage.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t.deliveriesPage.subtitle}</p>
        </div>
      </div>

      <DeliveriesClient
        deliveries={rows}
        labels={{
          searchPlaceholder: t.deliveriesPage.table.searchPlaceholder,
          table: {
            number: t.deliveriesPage.table.number,
            created: t.deliveriesPage.table.created,
            orders: t.deliveriesPage.table.orders,
            note: t.deliveriesPage.table.note,
            pdf: t.deliveriesPage.table.pdf,
            csv: t.deliveriesPage.table.csv,
            empty: t.deliveriesPage.table.empty,
            noResults: t.deliveriesPage.table.noResults,
          },
          detail: {
            title: t.deliveriesPage.detail.title,
            note: t.deliveriesPage.detail.note,
            created: t.deliveriesPage.detail.created,
            download: t.deliveriesPage.detail.download,
            regenerate: t.deliveriesPage.detail.regenerate,
            downloadCsv: t.deliveriesPage.detail.downloadCsv,
            orders: t.deliveriesPage.detail.orders,
            order: t.deliveriesPage.detail.order,
            quantity: t.deliveriesPage.detail.quantity,
            brand: t.deliveriesPage.detail.brand,
            template: t.deliveriesPage.detail.template,
          },
        }}
      />
    </div>
  );
}
