import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/formatDateTime";
import { getCountryLabel } from "@/lib/countries";
import { ConfirmationDetailClient } from "@/components/confirmations/ConfirmationDetailClient";

type Props = {
  params: Promise<{ confirmationId: string }>;
};

export default async function ConfirmationDetailPage({ params }: Props) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") redirect("/orders");

  const { confirmationId } = await params;

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie) ? localeCookie : isLocale(userLocale) ? userLocale : "en";
  const localeTag = locale === "de" ? "de-AT" : "en-GB";
  const t = getTranslations(locale);
  const isDE = locale === "de";

  const delivery = await prisma.delivery.findUnique({
    where: { id: confirmationId },
    include: {
      createdBy: { select: { name: true, email: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          order: {
            include: {
              brand: { select: { name: true } },
              template: {
                select: {
                  label: true,
                  key: true,
                  product: { select: { name: true, nameEn: true, nameDe: true } },
                },
              },
              pdfOrderItems: {
                orderBy: { createdAt: "asc" },
                include: {
                  productFormat: {
                    include: {
                      product: { select: { name: true, nameEn: true, nameDe: true } },
                      format: { select: { name: true, nameDe: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) notFound();

  // Shipping address
  const countryCode = (delivery as any).shippingCountryCode;
  const countryName = countryCode ? getCountryLabel(isDE ? "de" : "en", countryCode) : null;
  const shippingLines = [
    (delivery as any).shippingCompany,
    (delivery as any).shippingStreet,
    (delivery as any).shippingAddressExtra,
    [(delivery as any).shippingPostalCode, (delivery as any).shippingCity].filter(Boolean).join(" "),
    countryName,
  ].filter((l): l is string => Boolean(l?.trim()));

  // Name resolvers
  const pn = (p: { name: string; nameEn?: string | null; nameDe?: string | null } | null | undefined) =>
    p ? (isDE ? p.nameDe : p.nameEn) ?? p.name : null;
  const fn = (f: { name: string; nameDe?: string | null } | null | undefined) =>
    f ? (isDE ? f.nameDe : null) ?? f.name : null;

  // Order rows
  const orders = delivery.items.map((item) => {
    const o = item.order;
    const isUpload = o.type === "UPLOAD";
    return {
      orderId: o.id,
      referenceCode: o.referenceCode,
      type: o.type as "TEMPLATE" | "UPLOAD",
      brandName: o.brand?.name ?? null,
      templateLabel: o.template?.label ?? o.template?.key ?? null,
      productName: isUpload
        ? o.pdfOrderItems.map((p) => pn(p.productFormat?.product)).filter(Boolean).join(", ") || null
        : pn((o.template as any)?.product),
      requesterName: o.requesterName ?? "",
      requesterRole: o.requesterRole ?? "",
      quantity: isUpload
        ? o.pdfOrderItems.reduce((sum, p) => sum + p.quantity, 0)
        : o.quantity ?? 0,
      deliveryTime: o.deliveryTime ?? "standard",
      pdfItems: isUpload
        ? o.pdfOrderItems.map((p) => ({
            filename: p.filename,
            quantity: p.quantity,
            pages: p.pages,
            productName: pn(p.productFormat?.product),
            formatName: fn(p.productFormat?.format),
          }))
        : [],
    };
  });

  const createdAtLabel = formatDateTime(delivery.createdAt, localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const createdByLabel = delivery.createdBy?.name ?? delivery.createdBy?.email ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/confirmations" className="hover:text-slate-600 transition-colors">
          ← {t.deliveriesPage.title}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{delivery.number}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-semibold tracking-tight">{delivery.number}</h1>

      {/* Row 1: Info cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Shipping address */}
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            {isDE ? "Lieferadresse" : "Ship To"}
          </h2>
          {shippingLines.length > 0 ? (
            <div className="text-sm text-slate-600">
              {shippingLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">\u2013</p>
          )}
          {delivery.note && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <h3 className="text-xs text-slate-400 mb-0.5">{isDE ? "Anmerkung" : "Note"}</h3>
              <p className="text-sm text-slate-600">{delivery.note}</p>
            </div>
          )}
        </section>

        {/* Details */}
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            Details
          </h2>
          <dl className="divide-y divide-slate-100">
            <div className="flex items-start gap-4 py-2.5">
              <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                {isDE ? "Erstellt" : "Created"}
              </dt>
              <dd className="text-sm text-slate-900">{createdAtLabel}</dd>
            </div>
            {createdByLabel && (
              <div className="flex items-start gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                  {isDE ? "Erstellt von" : "Created by"}
                </dt>
                <dd className="text-sm text-slate-900">{createdByLabel}</dd>
              </div>
            )}
            <div className="flex items-start gap-4 py-2.5">
              <dt className="w-20 shrink-0 text-xs text-slate-400 pt-0.5">
                {isDE ? "Positionen" : "Orders"}
              </dt>
              <dd className="text-sm text-slate-900">{orders.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Row 2+: Order tables */}
      <ConfirmationDetailClient
        confirmationId={delivery.id}
        deliveryNoteUrl={delivery.deliveryNoteUrl}
        orders={orders}
        labels={{
          businessCards: isDE ? "Visitenkarten" : "Business Cards",
          printJobs: isDE ? "Druckauftr\u00e4ge" : "Print Jobs",
          ref: isDE ? "Bestellnummer" : "Order No.",
          qty: isDE ? "Menge" : "Qty",
          product: isDE ? "Produkt" : "Product",
          name: isDE ? "Name / Funktion" : "Name / Role",
          brandTemplate: isDE ? "Marke / Vorlage" : "Brand / Template",
          file: isDE ? "Datei" : "File",
          format: "Format",
          pages: isDE ? "Seiten" : "Pages",
          express: "EXPRESS",
          downloadPdf: isDE ? "PDF herunterladen" : "Download PDF",
          downloadCsv: isDE ? "CSV herunterladen" : "Download CSV",
          regenerate: isDE ? "PDF neu generieren" : "Regenerate PDF",
        }}
      />
    </div>
  );
}
