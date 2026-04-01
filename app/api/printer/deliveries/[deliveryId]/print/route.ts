import { NextRequest, NextResponse } from "next/server";
import { put } from "@/lib/blob";
import { Buffer } from "buffer";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDeliveryNotePdf } from "@/lib/delivery-note";
import { isLocale } from "@/lib/i18n/messages";

export async function POST(_: NextRequest, context: { params: Promise<{ deliveryId: string }> }) {
  const session = await getServerAuthSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PRINTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { deliveryId } = await context.params;
  if (!deliveryId) {
    return NextResponse.json({ error: "Invalid delivery id" }, { status: 400 });
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
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
                  coverPaperStock: { select: { name: true } },
                  contentPaperStock: { select: { name: true } },
                  finish: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const locale = isLocale(session.user.locale) ? session.user.locale : "en";
  const isDE = locale === "de";
  const pn = (p: { name: string; nameEn?: string | null; nameDe?: string | null } | null | undefined) =>
    p ? (isDE ? p.nameDe : p.nameEn) ?? p.name : null;
  const fn = (f: { name: string; nameDe?: string | null } | null | undefined) =>
    f ? (isDE ? f.nameDe : null) ?? f.name : null;

  const shippingAddress = [
    (delivery as any).shippingCompany,
    (delivery as any).shippingStreet,
    (delivery as any).shippingAddressExtra,
    [(delivery as any).shippingPostalCode, (delivery as any).shippingCity].filter(Boolean).join(" ").trim(),
    (delivery as any).shippingCountryCode,
  ]
    .filter((line) => line && line.toString().trim().length > 0)
    .join("\n");

  const items = (delivery as any).items ?? [];

  const pdfBytes = await generateDeliveryNotePdf({
    deliveryNumber: delivery.number,
    createdAt: delivery.createdAt,
    note: delivery.note,
    locale: locale === "de" ? "de" : "en",
    shippingAddress,
    orders: items.map(({ order }: any) => {
      const base = {
        referenceCode: order.referenceCode,
        requesterName: order.requesterName ?? "",
        requesterRole: order.requesterRole ?? "",
        customerReference:
          typeof order.meta === "object" && order.meta && "customerReference" in order.meta
            ? order.meta.customerReference ?? null
            : null,
        brandName: order.brand?.name ?? null,
        deliveryTime: order.deliveryTime ?? "standard",
      };

      if (order.type === "UPLOAD") {
        return {
          ...base,
          type: "UPLOAD" as const,
          quantity: (order.pdfOrderItems ?? []).reduce((sum: number, i: any) => sum + i.quantity, 0),
          pdfOrderItems: (order.pdfOrderItems ?? []).map((item: any) => ({
            filename: item.filename,
            quantity: item.quantity,
            pages: item.pages,
            productName: pn(item.productFormat?.product),
            formatName: fn(item.productFormat?.format),
            coverPaper: item.coverPaperStock?.name ?? null,
            contentPaper: item.contentPaperStock?.name ?? null,
            finishName: item.finish?.name ?? null,
          })),
        };
      }

      return {
        ...base,
        type: "TEMPLATE" as const,
        templateLabel: order.template?.label ?? order.template?.key ?? "–",
        productName: pn(order.template?.product),
        quantity: order.quantity ?? 0,
      };
    }),
  });

  const pdfBuffer = Buffer.from(pdfBytes);
  const blobPath = `deliveries/${delivery.number}-${Date.now()}.pdf`;
  const upload = await put(blobPath, pdfBuffer, {
    access: "public",
  });

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { deliveryNoteUrl: upload.url },
  });

  return NextResponse.json({ url: upload.url });
}
