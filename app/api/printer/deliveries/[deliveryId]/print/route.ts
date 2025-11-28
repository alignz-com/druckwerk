import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
              template: { select: { label: true, key: true } },
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
  const pdfBytes = await generateDeliveryNotePdf({
    deliveryNumber: delivery.number,
    createdAt: delivery.createdAt,
    note: delivery.note,
    locale: locale === "de" ? "de" : "en",
    orders: delivery.items.map(({ order }) => ({
      referenceCode: order.referenceCode,
      requesterName: order.requesterName,
      templateLabel: order.template?.label ?? order.template?.key ?? "–",
      brandName: order.brand?.name ?? null,
      quantity: order.quantity,
    })),
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
