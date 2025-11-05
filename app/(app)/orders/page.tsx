import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrdersTable, type OrdersTableRow } from "@/components/orders/orders-table";
import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";

const formatDate = (date: Date, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

type OrdersPageProps = {
  searchParams?: Record<string, string | string[]>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
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

  const isAdmin = session.user.role === "ADMIN";
  const orders = await prisma.order.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      template: true,
      brand: true,
      user: { select: { name: true, email: true } },
    },
  });

  const wasCreated = searchParams?.created === "1";

  const tableData: OrdersTableRow[] = orders.map((order) => {
    const templateKey =
      typeof order.meta === "object" && order.meta && "templateKey" in order.meta
        ? (order.meta as { templateKey?: unknown }).templateKey
        : null;

    return {
      id: order.id,
      referenceCode: order.referenceCode,
      createdAtLabel: formatDate(order.createdAt, locale),
      createdAtValue: order.createdAt.getTime(),
      userName: order.user?.name ?? null,
      userEmail: (order.user?.email ?? order.requesterEmail) ?? null,
      templateLabel: order.template?.label ?? (typeof templateKey === "string" ? templateKey : order.templateId ?? "–"),
      quantity: order.quantity,
      status: order.status,
      statusLabel: t.statuses[order.status] ?? order.status,
      pdfUrl: order.pdfUrl,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t.ordersPage.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.ordersPage.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/orders/new">{t.ordersPage.buttonNew}</Link>
        </Button>
      </div>

      {wasCreated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t.ordersPage.success}
        </div>
      ) : null}

      <OrdersTable
        data={tableData}
        showUserColumn={isAdmin}
        labels={{
          reference: t.ordersPage.table.reference,
          created: t.ordersPage.table.created,
          user: t.ordersPage.table.user,
          template: t.ordersPage.table.template,
          quantity: t.ordersPage.table.quantity,
          status: t.ordersPage.table.status,
          pdf: t.ordersPage.table.pdf,
          viewPdf: t.ordersPage.table.viewPdf,
        }}
        searchPlaceholder={t.ordersPage.table.searchPlaceholder}
        emptyState={t.ordersPage.table.empty}
        noResults={t.ordersPage.table.noResults}
        pagination={{
          labelTemplate: t.ordersPage.table.pagination.label,
          previous: t.ordersPage.table.pagination.previous,
          next: t.ordersPage.table.pagination.next,
          reset: t.ordersPage.table.pagination.reset,
        }}
      />
    </div>
  );
}
