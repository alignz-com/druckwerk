import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { Buffer } from "buffer";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { generateDeliveryNotePdf } from "@/lib/delivery-note";
import { isLocale } from "@/lib/i18n/messages";

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

function formatDeliveryNumber(year: number, sequence: number) {
  return `DEL-${year}-${sequence.toString().padStart(5, "0")}`;
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

function extractAddress(meta: unknown) {
  if (!meta || typeof meta !== "object") return null;
  const address = (meta as Record<string, unknown>).address;
  if (!address || typeof address !== "object") return null;
  const addr = address as Record<string, unknown>;
  return {
    companyName: typeof addr.companyName === "string" ? addr.companyName : null,
    street: typeof addr.street === "string" ? addr.street : null,
    postalCode: typeof addr.postalCode === "string" ? addr.postalCode : null,
    city: typeof addr.city === "string" ? addr.city : null,
    countryCode: typeof addr.countryCode === "string" ? addr.countryCode : null,
    addressExtra: typeof addr.addressExtra === "string" ? addr.addressExtra : null,
  };
}

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PRINTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { orderIds?: unknown; note?: unknown };
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

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      brand: { select: { name: true } },
      template: { select: { label: true, key: true } },
    },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "No matching orders" }, { status: 400 });
  }

  const { deliveryNumber } = await reserveDeliveryNumber();

  const delivery = await prisma.$transaction(async (tx) => {
    const created = await tx.delivery.create({
      data: {
        number: deliveryNumber,
        note,
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
      data: { status: OrderStatus.READY_FOR_DELIVERY },
    });

    return created;
  });

  const locale = isLocale(session.user.locale) ? session.user.locale : "en";
  const pdfBytes = await generateDeliveryNotePdf({
    deliveryNumber,
    createdAt: new Date(delivery.createdAt),
    note,
    locale: locale === "de" ? "de" : "en",
    orders: orders.map((order) => ({
      referenceCode: order.referenceCode,
      templateLabel: order.template?.label ?? order.template?.key ?? "–",
      brandName: order.brand?.name ?? null,
      quantity: order.quantity,
      requesterName: order.requesterName,
      company: order.company ?? null,
      address: extractAddress(order.meta),
    })),
  });

  const pdfBuffer = Buffer.from(pdfBytes);
  const blobPath = `deliveries/${deliveryNumber}.pdf`;
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
      detailUrl: APP_URL ? `${APP_URL}/deliveries?detail=${encodeURIComponent(delivery.id)}` : undefined,
    },
  });
}
