import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">{t.ordersPage.empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.reference}</th>
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.created}</th>
                {isAdmin ? <th className="px-4 py-3 font-medium">{t.ordersPage.table.user}</th> : null}
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.template}</th>
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.quantity}</th>
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.status}</th>
                <th className="px-4 py-3 font-medium">{t.ordersPage.table.pdf}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const templateKey = typeof order.meta === "object" && order.meta && "templateKey" in order.meta ? (order.meta as any).templateKey : null;
                return (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{order.referenceCode}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(order.createdAt, locale)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3 text-slate-600">
                        {order.user?.name ?? order.requesterEmail}
                        <span className="block text-xs text-slate-400">{order.user?.email ?? order.requesterEmail}</span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-slate-600">
                      {order.template?.label ?? templateKey ?? order.templateId ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.quantity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={order.status === "SUBMITTED" ? "secondary" : "outline"}>
                        {t.statuses[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {order.pdfUrl ? (
                        <a
                          href={order.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t.ordersPage.table.viewPdf}
                        </a>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
