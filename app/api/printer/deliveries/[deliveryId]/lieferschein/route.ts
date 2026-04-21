import { NextRequest, NextResponse } from "next/server";
import { put } from "@/lib/blob";
import { Buffer } from "buffer";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateDeliveryNotePdf,
  deliveryPdfInclude,
  buildDeliveryNotePayload,
  reserveLieferscheinNumber,
} from "@/lib/delivery-note";
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
    include: deliveryPdfInclude,
  });

  if (!delivery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reuse existing LS number or reserve a new one
  const lsNumber = delivery.lieferscheinNumber ?? await reserveLieferscheinNumber();

  const locale = isLocale(session.user.locale) ? session.user.locale : "en";
  const payload = buildDeliveryNotePayload(delivery, locale === "de" ? "de" : "en", {
    documentType: "LS",
    numberOverride: lsNumber,
  });
  const pdfBytes = await generateDeliveryNotePdf(payload);

  const pdfBuffer = Buffer.from(pdfBytes);
  const blobPath = `deliveries/${lsNumber}-${Date.now()}.pdf`;
  const upload = await put(blobPath, pdfBuffer, {
    access: "public",
  });

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: {
      lieferscheinUrl: upload.url,
      lieferscheinNumber: lsNumber,
    },
  });

  return NextResponse.json({ url: upload.url, number: lsNumber });
}
