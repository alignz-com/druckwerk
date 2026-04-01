import { NextResponse } from "next/server";
import { put } from "@/lib/blob";
import { Buffer } from "buffer";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { generateDeliveryNotePdf } from "@/lib/delivery-note";
import { isLocale } from "@/lib/i18n/messages";

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

function formatDeliveryNumber(_year: number, sequence: number) {
  return `AB-${sequence.toString().padStart(5, "0")}`;
}

async function reserveDeliveryNumber() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const counter = await prisma.$transaction((tx) =>
    tx.deliveryReferenceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    }),
  );
  const sequence = counter.lastValue;
  return {
    deliveryNumber: formatDeliveryNumber(year, sequence),
  };
}

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PRINTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { orderIds?: unknown; note?: unknown; addressId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(payload.orderIds)
    ? payload.orderIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)
    : [];
  if (orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds must be a non-empty array of strings" }, { status: 400 });
  }
  const note = typeof payload.note === "string" ? payload.note : null;
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : "";

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
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
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "No matching orders" }, { status: 400 });
  }

  const brandIds = new Set(orders.map((o) => o.brandId).filter((id): id is string => Boolean(id)));
  if (brandIds.size !== 1) {
    return NextResponse.json({ error: "All orders must belong to the same brand" }, { status: 400 });
  }
  const brandId = Array.from(brandIds)[0];
  if (!addressId) {
    return NextResponse.json({ error: "addressId is required" }, { status: 400 });
  }

  const address = await prisma.brandAddress.findFirst({
    where: { id: addressId, brandId },
  });
  if (!address) {
    return NextResponse.json({ error: "Address not found for brand" }, { status: 404 });
  }

  // Check for orders that already have a confirmation
  const existingItems = await prisma.deliveryItem.findMany({
    where: { orderId: { in: orders.map((o) => o.id) } },
    select: { orderId: true, delivery: { select: { number: true } } },
  });
  if (existingItems.length > 0) {
    const refs = orders
      .filter((o) => existingItems.some((i) => i.orderId === o.id))
      .map((o) => o.referenceCode);
    return NextResponse.json(
      { error: `Orders already confirmed: ${refs.join(", ")}` },
      { status: 409 },
    );
  }

  const { deliveryNumber } = await reserveDeliveryNumber();

  const delivery = await prisma.$transaction(async (tx) => {
    const created = await (tx as any).delivery.create({
      data: {
        number: deliveryNumber,
        note,
        brandId,
        shippingName: address.label ?? null,
        shippingCompany: address.company ?? null,
        shippingStreet: address.street ?? null,
        shippingPostalCode: address.postalCode ?? null,
        shippingCity: address.city ?? null,
        shippingCountryCode: address.countryCode ?? null,
        shippingAddressExtra: address.addressExtra ?? null,
        createdByUserId: session.user.id!,
        items: {
          createMany: {
            data: orders.map((order, index) => ({
              orderId: order.id,
              position: index,
            })),
          },
        },
      },
    });

    await tx.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: OrderStatus.IN_PRODUCTION },
    });

    return created;
  });

  const locale = isLocale(session.user.locale) ? session.user.locale : "en";
  const isDE = locale === "de";
  const pn = (p: { name: string; nameEn?: string | null; nameDe?: string | null } | null | undefined) =>
    p ? (isDE ? p.nameDe : p.nameEn) ?? p.name : null;
  const fn = (f: { name: string; nameDe?: string | null } | null | undefined) =>
    f ? (isDE ? f.nameDe : null) ?? f.name : null;

  const pdfBytes = await generateDeliveryNotePdf({
    deliveryNumber,
    createdAt: new Date(delivery.createdAt),
    note,
    locale: locale === "de" ? "de" : "en",
    shippingAddress: [
      address.company,
      address.street,
      address.addressExtra,
      [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
      address.countryCode,
    ]
      .filter((line) => line && line.toString().trim().length > 0)
      .join("\n"),
    orders: orders.map((order) => {
      const base = {
        referenceCode: order.referenceCode,
        requesterName: order.requesterName ?? "",
        requesterRole: order.requesterRole ?? "",
        customerReference:
          typeof order.meta === "object" && order.meta && "customerReference" in order.meta
            ? (order.meta as any).customerReference ?? null
            : null,
        brandName: order.brand?.name ?? null,
        deliveryTime: order.deliveryTime ?? "standard",
      };

      if (order.type === "UPLOAD") {
        return {
          ...base,
          type: "UPLOAD" as const,
          quantity: order.pdfOrderItems.reduce((sum, item) => sum + item.quantity, 0),
          pdfOrderItems: order.pdfOrderItems.map((item) => ({
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
        productName: pn((order.template as any)?.product),
        quantity: order.quantity ?? 0,
      };
    }),
  });

  const pdfBuffer = Buffer.from(pdfBytes);
  const blobPath = `deliveries/${deliveryNumber}-${Date.now()}.pdf`;
  const upload = await put(blobPath, pdfBuffer, {
    access: "public",
  });

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { deliveryNoteUrl: upload.url },
  });

  return NextResponse.json({
    delivery: {
      id: delivery.id,
      number: deliveryNumber,
      note,
      createdAt: delivery.createdAt,
      orderCount: orders.length,
      deliveryNoteUrl: upload.url,
      detailUrl: APP_URL ? `${APP_URL}/confirmations/${encodeURIComponent(delivery.id)}` : undefined,
    },
  });
}
