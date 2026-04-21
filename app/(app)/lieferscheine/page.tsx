import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { getCountryLabel } from "@/lib/countries";
import { ConfirmationsList } from "@/components/confirmations/ConfirmationsList";
import type { ConfirmationRow } from "../confirmations/page";

export default async function LieferscheinePage() {
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
    where: { lieferscheinNumber: { not: null } },
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
      number: d.lieferscheinNumber ?? d.number,
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
          {isDE ? "Lieferscheine" : "Delivery Notes"}
        </h1>
        <p className="text-sm text-slate-500">
          {isDE ? "Alle erstellten Lieferscheine." : "All generated delivery notes."}
        </p>
      </header>

      <ConfirmationsList
        confirmations={rows}
        searchPlaceholder={t.deliveriesPage.table.searchPlaceholder}
        columns={{
          number: isDE ? "Nummer" : "Number",
          created: t.deliveriesPage.table.created,
          orders: t.deliveriesPage.table.orders,
          shipTo: isDE ? "Lieferadresse" : "Ship To",
          note: t.deliveriesPage.table.note,
        }}
        empty={isDE ? "Noch keine Lieferscheine." : "No delivery notes yet."}
        noResults={t.deliveriesPage.table.noResults}
      />
    </div>
  );
}
