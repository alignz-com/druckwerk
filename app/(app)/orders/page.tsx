import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { OrdersTable, type OrdersTableRow } from "@/components/orders/orders-table";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";

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
  const localeTag = locale === "de" ? "de-AT" : "en-GB";
  const t = getTranslations(locale);

  const role = session.user.role;
  const brandId = session.user.brandId ?? null;
  const isAdmin = role === "ADMIN";
  const isBrandAdmin = role === "BRAND_ADMIN";
  const isPrinter = role === "PRINTER";
  const statusOptions = Object.values(OrderStatus).map((status) => ({
    value: status,
    label: t.statuses[status as keyof typeof t.statuses] ?? status,
  }));
  const orders = await prisma.order.findMany({
    where: isAdmin || isPrinter ? {} : isBrandAdmin && brandId ? { brandId } : { userId: session.user.id },
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
    const customerReference =
      typeof order.meta === "object" && order.meta && "customerReference" in order.meta
        ? String((order.meta as { customerReference?: unknown }).customerReference ?? "")
        : "";
    const addressMeta =
      typeof order.meta === "object" && order.meta && "address" in order.meta
        ? ((order.meta as { address?: Record<string, unknown> }).address as Record<string, unknown> | undefined)
        : undefined;
    const deliveryTimeLabel =
      (order.deliveryTime in t.orderForm.deliveryTimes
        ? t.orderForm.deliveryTimes[order.deliveryTime as "express" | "standard"]
        : order.deliveryTime) ?? order.deliveryTime;
    const createdAtLabel = formatDateTime(order.createdAt, localeTag, { dateStyle: "medium" });
    const deliveryDueAtLabel = order.deliveryDueAt ? formatDateTime(order.deliveryDueAt, localeTag, { dateStyle: "medium" }) : null;
    const deliveryDueAtDetailLabel = order.deliveryDueAt ? formatDateTime(order.deliveryDueAt, localeTag) : null;

    return {
      id: order.id,
      referenceCode: order.referenceCode,
      createdAtLabel,
      createdAtValue: order.createdAt.getTime(),
      userName: order.user?.name ?? null,
      userEmail: (order.user?.email ?? order.requesterEmail) ?? null,
      templateLabel: order.template?.label ?? (typeof templateKey === "string" ? templateKey : order.templateId ?? "–"),
      quantity: order.quantity,
      status: order.status,
      statusLabel: t.statuses[order.status] ?? order.status,
      deliveryTime: order.deliveryTime,
      deliveryTimeLabel,
      deliveryDueAtLabel,
      deliveryDueAtValue: order.deliveryDueAt?.getTime() ?? null,
      templateKey: typeof templateKey === "string" ? templateKey : order.template?.key ?? null,
      brandId: order.brandId,
      brandName: order.brand?.name ?? null,
      detail: {
        requester: {
          name: order.requesterName,
          role: order.requesterRole ?? "",
          email: order.requesterEmail,
          phone: order.phone ?? "",
          mobile: order.mobile ?? "",
          url: order.url ?? "",
          linkedin: order.linkedin ?? "",
        },
        company: order.company ?? "",
        address: addressMeta,
        quantity: order.quantity,
        deliveryTime: order.deliveryTime,
        deliveryTimeLabel,
        customerReference: customerReference || "",
        brandName: order.brand?.name ?? "–",
        templateLabel:
          order.template?.label ?? (typeof templateKey === "string" ? templateKey : order.templateId ?? "–"),
        deliveryDueAtLabel: deliveryDueAtDetailLabel,
      },
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
        showBrandColumn={isAdmin || isPrinter}
        labels={{
          brand: t.ordersPage.table.brand,
          created: t.ordersPage.table.created,
          user: t.ordersPage.table.user,
          template: t.ordersPage.table.template,
          quantity: t.ordersPage.table.quantity,
          status: t.ordersPage.table.status,
          delivery: t.ordersPage.table.delivery,
          view: t.ordersPage.table.view,
        }}
        detailLabels={{
          title: t.ordersPage.detail.title,
          status: t.ordersPage.detail.status,
          brand: t.ordersPage.detail.brand,
          template: t.ordersPage.detail.template,
          quantity: t.ordersPage.detail.quantity,
          delivery: t.ordersPage.detail.delivery,
          customerReference: t.ordersPage.detail.customerReference,
          requester: t.ordersPage.detail.requester,
          company: t.ordersPage.detail.company,
          address: t.ordersPage.detail.address,
          contact: t.ordersPage.detail.contact,
          previewTitle: t.ordersPage.detail.previewTitle,
          close: t.ordersPage.detail.close,
          loadingTemplate: t.ordersPage.detail.loadingTemplate,
          loadingPreview: t.ordersPage.detail.loadingPreview,
          noTemplate: t.ordersPage.detail.noTemplate,
          name: t.ordersPage.detail.name,
          role: t.ordersPage.detail.role,
          email: t.ordersPage.detail.email,
          phone: t.ordersPage.detail.phone,
          mobile: t.ordersPage.detail.mobile,
          url: t.ordersPage.detail.url,
          linkedin: t.ordersPage.detail.linkedin,
          companyName: t.ordersPage.detail.companyName,
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
        selectionLabelTemplate={t.ordersPage.table.selection}
        bulkStatus={
          isAdmin || isPrinter
            ? {
                options: statusOptions,
                labels: {
                  label: t.ordersPage.table.bulkActions.label,
                  placeholder: t.ordersPage.table.bulkActions.placeholder,
                  apply: t.ordersPage.table.bulkActions.apply,
                  success: t.ordersPage.table.bulkActions.success,
                  error: t.ordersPage.table.bulkActions.error,
                },
              }
            : undefined
        }
      />
    </div>
  );
}
