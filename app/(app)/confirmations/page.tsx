import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { ConfirmationsList } from "@/components/confirmations/ConfirmationsList";

export type ConfirmationRow = {
  id: string;
  number: string;
  createdAtLabel: string;
  createdAtValue: number;
  orderCount: number;
  note: string | null;
  deliveryNoteUrl: string | null;
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
  const t = getTranslations(locale);

  const deliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { select: { id: true } },
    },
  });

  const rows: ConfirmationRow[] = deliveries.map((d) => ({
    id: d.id,
    number: d.number,
    createdAtLabel: formatDateTime(d.createdAt, localeTag, { dateStyle: "medium" }),
    createdAtValue: d.createdAt.getTime(),
    orderCount: d.items.length,
    note: d.note ?? null,
    deliveryNoteUrl: d.deliveryNoteUrl ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.deliveriesPage.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t.deliveriesPage.subtitle}</p>
      </div>

      <ConfirmationsList
        confirmations={rows}
        searchPlaceholder={t.deliveriesPage.table.searchPlaceholder}
        columns={{
          number: t.deliveriesPage.table.number,
          created: t.deliveriesPage.table.created,
          orders: t.deliveriesPage.table.orders,
          note: t.deliveriesPage.table.note,
        }}
        empty={t.deliveriesPage.table.empty}
        noResults={t.deliveriesPage.table.noResults}
      />
    </div>
  );
}
