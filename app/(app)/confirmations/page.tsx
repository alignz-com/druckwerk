import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { getCountryLabel } from "@/lib/countries";
import { ConfirmationsList } from "@/components/confirmations/ConfirmationsList";

export type ConfirmationRow = {
  id: string;
  number: string;
  createdAtLabel: string;
  createdAtValue: number;
  orderCount: number;
  note: string | null;
  shipTo: string | null;
};

export default async function ConfirmationsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") redirect("/orders");

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie) ? localeCookie : isLocale(userLocale) ? userLocale : "en";
  const localeTag = locale === "de" ? "de-AT" : "en-GB";
  const isDE = locale === "de";
  const t = getTranslations(locale);

  const deliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { select: { id: true } },
    },
  });

  const rows: ConfirmationRow[] = deliveries.map((d) => {
    const countryCode = (d as any).shippingCountryCode;
    const countryName = countryCode ? getCountryLabel(isDE ? "de" : "en", countryCode) : null;
    const shipTo = [
      (d as any).shippingCompany,
      (d as any).shippingCity,
      countryName,
    ].filter((l): l is string => Boolean(l?.trim())).join(", ") || null;

    return {
      id: d.id,
      number: d.number,
      createdAtLabel: formatDateTime(d.createdAt, localeTag, { dateStyle: "medium" }),
      createdAtValue: d.createdAt.getTime(),
      orderCount: d.items.length,
      note: d.note ?? null,
      shipTo,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.deliveriesPage.title}
        </h1>
        <p className="text-sm text-slate-500">{t.deliveriesPage.subtitle}</p>
      </header>

      <ConfirmationsList
        confirmations={rows}
        searchPlaceholder={t.deliveriesPage.table.searchPlaceholder}
        columns={{
          number: t.deliveriesPage.table.number,
          created: t.deliveriesPage.table.created,
          orders: t.deliveriesPage.table.orders,
          shipTo: isDE ? "Lieferadresse" : "Ship To",
          note: t.deliveriesPage.table.note,
        }}
        empty={t.deliveriesPage.table.empty}
        noResults={t.deliveriesPage.table.noResults}
      />
    </div>
  );
}
