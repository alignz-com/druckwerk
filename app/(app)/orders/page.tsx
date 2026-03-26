export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { OrdersTable, type OrdersTableRow } from "@/components/orders/orders-table";
import { OrderCardList } from "@/components/orders/OrderCardList";
import type { OrderCardData } from "@/components/orders/OrderCardRow";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { Plus } from "lucide-react";
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign";
import { resolveAllowedQuantities } from "@/lib/order-quantities";
import { getUserAccessibleWorkflows } from "@/lib/user-products";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[]>>;
};

export default async function OrdersPage({ searchParams: searchParamsPromise }: OrdersPageProps) {
  const searchParams = await searchParamsPromise;
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
  let brandId = session.user.brandId ?? null;
  if (!brandId && session.user.email) {
    const ensured = await ensureBrandAssignmentForUser({
      userId: session.user.id,
      email: session.user.email,
    });
    if (ensured) {
      brandId = ensured;
      session.user.brandId = ensured;
    }
  }
  const isAdmin = role === "ADMIN";
  const isBrandAdmin = role === "BRAND_ADMIN";
  const isPrinter = role === "PRINTER";
  const statusOptions = Object.values(OrderStatus).map((status) => ({
    value: status,
    label: t.statuses[status as keyof typeof t.statuses] ?? status,
  }));
  // Determine which view to show — run both in parallel
  const [access, orders] = await Promise.all([
    getUserAccessibleWorkflows(session.user.id, brandId),
    prisma.order.findMany({
      where: isAdmin || isPrinter ? {} : isBrandAdmin && brandId ? { brandId } : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          include: {
            product: { select: { name: true, nameEn: true, nameDe: true } },
          },
        },
        brand: true,
        user: { select: { name: true, email: true } },
        _count: { select: { pdfOrderItems: true } },
        pdfOrderItems: {
          select: {
            filename: true,
            pages: true,
            quantity: true,
            thumbnailStoragePath: true,
            productFormat: { select: { product: { select: { name: true, nameEn: true, nameDe: true } }, format: { select: { name: true, nameDe: true } } } },
          },
          orderBy: { createdAt: "asc" as const },
        },
      },
    }),
  ]);
  const useCardView = true;

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
    const qrMode =
      typeof order.meta === "object" && order.meta && "qrMode" in order.meta
        ? String((order.meta as { qrMode?: unknown }).qrMode ?? "")
        : "";
    const publicProfileUrl =
      typeof order.meta === "object" && order.meta && "publicProfileUrl" in order.meta
        ? String((order.meta as { publicProfileUrl?: unknown }).publicProfileUrl ?? "")
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
      orderType: order.type as "TEMPLATE" | "UPLOAD",
      createdAtLabel,
      createdAtValue: order.createdAt.getTime(),
      userName: order.user?.name ?? null,
      userEmail: (order.user?.email ?? order.requesterEmail) ?? null,
      templateLabel: order.template?.label ?? (typeof templateKey === "string" ? templateKey : order.templateId ?? "–"),
      quantity: order.quantity ?? 0,
      quantityLabel: (order.quantity ?? 0).toLocaleString(localeTag),
      status: order.status,
      statusLabel: t.statuses[order.status] ?? order.status,
      deliveryTime: order.deliveryTime,
      deliveryTimeLabel,
      deliveryDueAtLabel,
      deliveryDueAtValue: order.deliveryDueAt?.getTime() ?? null,
      templateKey: typeof templateKey === "string" ? templateKey : order.template?.key ?? null,
      brandId: order.brandId,
      brandName: order.brand?.name ?? null,
      allowedQuantities: resolveAllowedQuantities(order.brand ?? undefined),
      detail: {
        requester: {
          name: order.requesterName ?? "",
          role: order.requesterRole ?? "",
          seniority: order.requesterSeniority ?? "",
          email: order.requesterEmail ?? "",
          phone: order.phone ?? "",
          mobile: order.mobile ?? "",
          url: order.url ?? "",
          linkedin: order.linkedin ?? "",
        },
        company: order.company ?? "",
        address: addressMeta,
        quantity: order.quantity ?? 0,
        deliveryTime: order.deliveryTime,
        deliveryTimeLabel,
        customerReference: customerReference || "",
        qrMode: qrMode === "public" ? "public" : "vcard",
        publicProfileUrl: publicProfileUrl || null,
        brandName: order.brand?.name ?? "–",
        templateLabel:
          order.template?.label ?? (typeof templateKey === "string" ? templateKey : order.templateId ?? "–"),
        deliveryDueAtLabel: deliveryDueAtDetailLabel,
      },
    };
  });

  const cardData: OrderCardData[] = orders.map((order) => {
    const templateKey =
      typeof order.meta === "object" && order.meta && "templateKey" in order.meta
        ? (order.meta as { templateKey?: unknown }).templateKey
        : null;
    const deliveryDueAtLabel = order.deliveryDueAt
      ? formatDateTime(order.deliveryDueAt, localeTag, { dateStyle: "medium" })
      : null;
    const firstThumbPath = order.pdfOrderItems.find(i => i.thumbnailStoragePath)?.thumbnailStoragePath ?? null;
    const thumbnailUrl =
      order.type === "TEMPLATE"
        ? (order.thumbnailUrl ?? order.template?.previewFrontPath ?? null)
        : firstThumbPath
          ? `${process.env.S3_PUBLIC_URL ?? ""}/${process.env.S3_ORDERS_BUCKET ?? "orders"}/${firstThumbPath}`
          : null;
    const firstItem = order.pdfOrderItems[0] ?? null;
    const isBC = order.type === "TEMPLATE";

    // For BC: product name from template.product (localized)
    const bcProductName = (() => {
      if (!isBC) return null;
      const prod = order.template?.product;
      if (!prod) return null;
      return (locale === "de" ? prod.nameDe : prod.nameEn) ?? prod.name;
    })();

    // For PDF: joined distinct product names
    const pdfProductLabel = (() => {
      if (isBC) return null;
      const names = Array.from(new Set(
        order.pdfOrderItems
          .filter(i => i.productFormat?.product)
          .map(i => (locale === "de" ? i.productFormat!.product!.nameDe : i.productFormat!.product!.nameEn) ?? i.productFormat!.product!.name)
      ));
      if (names.length === 0) return null;
      return names.slice(0, 2).join(" · ") + (names.length > 2 ? ` +${names.length - 2}` : "");
    })();

    // Quantity: BC uses order.quantity; PDF sums item quantities
    const totalQuantity = isBC
      ? (order.quantity ?? null)
      : order.pdfOrderItems.reduce((s, i) => s + i.quantity, 0) || null;

    // PDF multi-file: per-product quantity breakdown
    const productBreakdown = (() => {
      if (isBC || order.pdfOrderItems.length <= 1) return null;
      const map = new Map<string, number>();
      for (const item of order.pdfOrderItems) {
        const prod = item.productFormat?.product;
        const name = prod
          ? ((locale === "de" ? prod.nameDe : prod.nameEn) ?? prod.name)
          : null;
        if (!name) continue;
        map.set(name, (map.get(name) ?? 0) + item.quantity);
      }
      if (map.size === 0) return null;
      return Array.from(map.entries()).map(([name, quantity]) => ({ name, quantity }));
    })();

    // PDF: total pages + per-file breakdown for tooltip
    const totalPageCount = isBC ? null : order.pdfOrderItems.reduce((s, i) => s + (i.pages ?? 0) * i.quantity, 0) || null;
    const pageBreakdown = (() => {
      if (isBC || order.pdfOrderItems.length <= 1) return null;
      return order.pdfOrderItems.map((item) => {
        const prod = item.productFormat?.product;
        const fmt = item.productFormat?.format;
        const product = prod ? ((locale === "de" ? prod.nameDe : prod.nameEn) ?? prod.name) : null;
        const format = fmt ? ((locale === "de" ? fmt.nameDe : null) ?? fmt.name) : null;
        return { product, format, pages: item.pages ?? 0, quantity: item.quantity };
      }).filter(i => i.pages > 0);
    })();

    return {
      id: order.id,
      referenceCode: order.referenceCode,
      orderType: order.type as "TEMPLATE" | "UPLOAD",
      deliveryTime: order.deliveryTime,
      brandId: order.brandId ?? null,
      brandName: order.brand?.name ?? null,
      // BC: template.label for pill; PDF: joined product names
      templateLabel: isBC
        ? (order.template?.label ?? (typeof templateKey === "string" ? templateKey : null))
        : pdfProductLabel,
      productName: bcProductName,
      thumbnailUrl,
      company: order.company ?? order.brand?.name ?? null,
      requesterName: order.requesterName ?? null,
      requesterRole: order.requesterRole ?? null,
      requesterSeniority: order.requesterSeniority ?? null,
      orderedByName: order.user?.name ?? null,
      quantity: totalQuantity,
      fileCount: order._count.pdfOrderItems || null,
      primaryFileName: isBC ? null : (firstItem?.filename ?? null),
      primaryPageCount: isBC ? null : (firstItem?.pages ?? null),
      productBreakdown,
      totalPageCount,
      pageBreakdown,
      status: order.status,
      statusLabel: t.statuses[order.status] ?? order.status,
      deliveryDueAtLabel,
      createdAtLabel: formatDateTime(order.createdAt, localeTag, { dateStyle: "medium" }),
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.ordersPage.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.ordersPage.subtitle}</p>
        </div>
        <Button asChild className="inline-flex items-center gap-2">
          <Link href="/orders/new">
            <Plus className="size-4" aria-hidden="true" />
            {t.ordersPage.buttonNew}
          </Link>
        </Button>
      </div>

      {wasCreated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t.ordersPage.success}
        </div>
      ) : null}

      {useCardView ? (
        <OrderCardList
          orders={cardData}
          showBrand={isAdmin || isPrinter}
          searchPlaceholder={t.ordersPage.table.searchPlaceholder}
          emptyState={t.ordersPage.table.empty}
          noResults={t.ordersPage.table.noResults}
          allStatusesLabel={t.ordersPage.table.filters.allStatuses}
          allBrandsLabel={t.ordersPage.table.filters.allBrands}
          statusOptions={statusOptions}
          brandOptions={
            isAdmin || isPrinter
              ? Array.from(
                  new Map(
                    orders
                      .filter((o) => o.brandId && o.brand?.name)
                      .map((o) => [o.brandId as string, o.brand!.name]),
                  ).entries(),
                )
                  .map(([value, label]) => ({ value, label }))
                  .sort((a, b) => a.label.localeCompare(b.label))
              : []
          }
          paginationLabelTemplate={t.ordersPage.table.pagination.label}
          previousLabel={t.ordersPage.table.pagination.previous}
          nextLabel={t.ordersPage.table.pagination.next}
          bulkLabels={
            isAdmin || isPrinter
              ? {
                  selectMode: t.ordersPage.cardList.select,
                  cancelSelect: t.ordersPage.cardList.cancelSelect,
                  selectedCount: t.ordersPage.table.selection,
                  statusPlaceholder: t.ordersPage.table.bulkActions.placeholder,
                  applyStatus: t.ordersPage.table.bulkActions.apply,
                  applying: t.ordersPage.cardList.applying,
                  statusSuccess: t.ordersPage.table.bulkActions.success,
                  statusError: t.ordersPage.table.bulkActions.error,
                  createDelivery: t.ordersPage.cardList.createDelivery,
                  deliveryTitle: t.ordersPage.table.bulkDelivery.title,
                  deliveryAddress: t.ordersPage.cardList.deliveryAddress,
                  loadingAddresses: t.ordersPage.cardList.loadingAddresses,
                  noAddresses: t.ordersPage.cardList.noAddresses,
                  deliveryNoteLabel: t.ordersPage.table.bulkDelivery.noteLabel,
                  deliveryNotePlaceholder: t.ordersPage.table.bulkDelivery.notePlaceholder,
                  deliveryCreate: t.ordersPage.table.bulkDelivery.apply,
                  deliveryCreating: t.ordersPage.table.bulkDelivery.creating,
                  deliverySuccess: t.ordersPage.table.bulkDelivery.success,
                  deliveryError: t.ordersPage.table.bulkDelivery.error,
                  deliveryMixedBrands: t.ordersPage.cardList.mixedBrands,
                  kanbanShowMore: t.ordersPage.cardList.kanbanShowMore,
                }
              : undefined
          }
        />
      ) : (
      <OrdersTable
        data={tableData}
        showBrandColumn={isAdmin || isPrinter}
        locale={localeTag}
        canEditQuantity={isAdmin || isPrinter}
        canRegenerateJdf={isAdmin || isPrinter}
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
          actionsTitle: t.ordersPage.detail.actionsTitle,
          close: t.ordersPage.detail.close,
          loadingTemplate: t.ordersPage.detail.loadingTemplate,
          loadingPreview: t.ordersPage.detail.loadingPreview,
          noTemplate: t.ordersPage.detail.noTemplate,
          name: t.ordersPage.detail.name,
          role: t.ordersPage.detail.role,
          seniority: t.ordersPage.detail.seniority,
          email: t.ordersPage.detail.email,
          phone: t.ordersPage.detail.phone,
          mobile: t.ordersPage.detail.mobile,
          url: t.ordersPage.detail.url,
          linkedin: t.ordersPage.detail.linkedin,
          companyName: t.ordersPage.detail.companyName,
          deleteAction: t.ordersPage.detail.deleteAction,
          deleteRunning: t.ordersPage.detail.deleteRunning,
          deleteConfirm: t.ordersPage.detail.deleteConfirm,
          deleteError: t.ordersPage.detail.deleteError,
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
        filters={
          isAdmin || isPrinter
            ? {
                brand: {
                  label: t.ordersPage.table.filters.brand,
                  allLabel: t.ordersPage.table.filters.allBrands,
                  options: Array.from(
                    new Map(
                      tableData
                        .filter((row) => row.brandId && row.brandName)
                        .map((row) => [row.brandId as string, row.brandName as string]),
                    ).entries(),
                  )
                    .map(([value, label]) => ({ value, label }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                },
                status: {
                  label: t.ordersPage.table.filters.status,
                  allLabel: t.ordersPage.table.filters.allStatuses,
                  options: statusOptions,
                },
              }
            : undefined
        }
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
        bulkDelivery={
          isAdmin || isPrinter
            ? {
                label: t.ordersPage.table.bulkDelivery.title,
                apply: t.ordersPage.table.bulkDelivery.apply,
                creating: t.ordersPage.table.bulkDelivery.creating,
                success: t.ordersPage.table.bulkDelivery.success,
                error: t.ordersPage.table.bulkDelivery.error,
                noteLabel: t.ordersPage.table.bulkDelivery.noteLabel,
                notePlaceholder: t.ordersPage.table.bulkDelivery.notePlaceholder,
              }
            : undefined
        }
      />
      )}
    </div>
  );
}
