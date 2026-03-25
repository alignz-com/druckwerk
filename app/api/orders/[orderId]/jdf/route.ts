import { NextResponse } from "next/server";
import { put } from "@/lib/blob";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildJdfDocument } from "@/lib/jdf";
import { getTemplateForBrandOrGlobal } from "@/lib/templates";
import { generatePdfOrderJdfs } from "@/lib/generate-pdf-order-jdfs";
import { S3_PUBLIC_URL, ORDERS_BUCKET } from "@/lib/s3";

type RouteParams = { orderId: string };

async function resolveParams(context: { params: Promise<RouteParams> }): Promise<RouteParams> {
  const params = await Promise.resolve(context.params);
  if (!params?.orderId) throw new Error("Missing route parameter: orderId");
  return params;
}

type AddressMeta = {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  addressExtra?: string;
};

export async function POST(_req: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await resolveParams(context);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      brand: true,
      template: true,
      pdfOrderItems: {
        include: { productFormat: { include: { format: true } } },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // ─── Multi-item PDF print order ────────────────────────────────────────────
    if (order.pdfOrderItems.length > 0) {
      return await handlePdfOrder(orderId, session);
    }

    // ─── Single-product business card order ───────────────────────────────────
    return await handleBusinessCardOrder(order, orderId);
  } catch (err) {
    console.error("[jdf] error for order", orderId, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Business card JDF (unchanged logic) ─────────────────────────────────────

async function handleBusinessCardOrder(
  order: Awaited<ReturnType<typeof prisma.order.findUnique>> & { brand: any; template: any },
  orderId: string
) {
  if (!order!.pdfUrl) {
    return NextResponse.json({ error: "Order has no PDF yet" }, { status: 400 });
  }

  const meta = typeof order!.meta === "object" && order!.meta ? (order!.meta as Record<string, unknown>) : {};
  const templateKey =
    (typeof meta.templateKey === "string" && meta.templateKey.trim()) ||
    order!.template?.key ||
    order!.templateId;
  if (!templateKey) {
    return NextResponse.json({ error: "Template key missing" }, { status: 400 });
  }

  const addressMeta = (meta.address as AddressMeta | undefined) ?? undefined;
  const requesterCompany =
    addressMeta?.companyName?.trim() || order!.company?.split("\n")[0]?.trim() || order!.brand?.name || null;

  const requesterContact = {
    company: requesterCompany,
    personName: order!.requesterName ?? null,
    email: order!.requesterEmail ?? null,
    phone: order!.phone || null,
    mobile: order!.mobile || null,
    street: addressMeta?.street ?? null,
    city: addressMeta?.city ?? null,
    postalCode: addressMeta?.postalCode ?? null,
    country: addressMeta?.country ?? null,
    countryCode: addressMeta?.countryCode ?? null,
  };

  const administratorContact = order!.brand
    ? {
        company: order!.brand.name,
        personName: order!.brand.contactName ?? null,
        email: order!.brand.contactEmail ?? null,
        phone: order!.brand.contactPhone ?? null,
      }
    : undefined;

  const deliveryAddress = addressMeta
    ? {
        companyName: addressMeta.companyName || order!.company || order!.brand?.name || undefined,
        street: addressMeta.street,
        postalCode: addressMeta.postalCode,
        city: addressMeta.city,
        country: addressMeta.country,
        countryCode: addressMeta.countryCode,
        addressExtra: addressMeta.addressExtra,
      }
    : undefined;

  const templateDefinition = await getTemplateForBrandOrGlobal(templateKey, order!.brandId ?? null);
  if (!templateDefinition) {
    return NextResponse.json({ error: "Template is missing PDF asset" }, { status: 422 });
  }
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : undefined;

  const jdfXml = buildJdfDocument({
    referenceCode: order!.referenceCode,
    templateKey,
    pcmCode: templateDefinition.pcmCode ?? null,
    brandName: order!.brand?.name ?? null,
    requester: requesterContact,
    administrator: administratorContact,
    deliveryAddress,
    quantity: order!.quantity ?? 0,
    pdfUrl: order!.pdfUrl,
    pdfFileName: order!.pdfFileName ?? `${order!.referenceCode}.pdf`,
    trimWidthMm: templateDefinition.pageWidthMm ?? null,
    trimHeightMm: templateDefinition.pageHeightMm ?? null,
    customerReference,
    deliveryDueAt: order!.deliveryDueAt ?? undefined,
    createdAt: order!.createdAt ?? undefined,
    paperStock: templateDefinition.paperStock ?? undefined,
  });

  const jdfFileName = `${order!.referenceCode}.jdf`;
  const jdfStorageKey = `${order!.referenceCode}/${jdfFileName}`;
  const jdfBlob = new Blob([jdfXml], { type: "application/xml" });
  const jdfUpload = await put(jdfStorageKey, jdfBlob, {
    access: "public",
    contentType: "application/xml",
    allowOverwrite: true,
  });

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      jdfUrl: jdfUpload.url,
      jdfBlobId: jdfUpload.pathname ?? jdfUpload.url,
      jdfFileName,
    },
  });

  // BC orders: one JdfExportJob per order (find-or-create since orderId is no longer unique)
  const existingJob = await prisma.jdfExportJob.findFirst({
    where: { orderId, pdfOrderItemId: null },
  });
  if (existingJob) {
    await prisma.jdfExportJob.update({
      where: { id: existingJob.id },
      data: {
        pdfUrl: order!.pdfUrl,
        jdfXml,
        jdfUrl: jdfUpload.url,
        jdfFileName,
        status: "PENDING",
        attemptCount: 0,
        lastError: null,
      },
    });
  } else {
    await prisma.jdfExportJob.create({
      data: {
        orderId,
        pdfUrl: order!.pdfUrl,
        jdfXml,
        jdfUrl: jdfUpload.url,
        jdfFileName,
      },
    });
  }

  return NextResponse.json({ jdfUrl: updatedOrder.jdfUrl });
}

// ─── Multi-item PDF order JDF (one JDF per PdfOrderItem) ─────────────────────

async function handlePdfOrder(orderId: string, session: any) {
  const { jdfUrls, itemCount } = await generatePdfOrderJdfs(orderId, session?.user);
  return NextResponse.json({ jdfUrls, itemCount });
}
