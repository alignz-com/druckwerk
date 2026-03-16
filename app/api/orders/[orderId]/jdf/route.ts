import { NextResponse } from "next/server";
import { put } from "@/lib/blob";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildJdfDocument, buildPdfItemJdfDocument } from "@/lib/jdf";
import { getTemplateForBrandOrGlobal } from "@/lib/templates";
import { extractAndUploadPdfItem } from "@/lib/pdf-item-extract";
import { S3_PUBLIC_URL, ORDERS_BUCKET } from "@/lib/s3";

type RouteParams = { orderId: string };

async function resolveParams(context: { params: RouteParams | Promise<RouteParams> }): Promise<RouteParams> {
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

export async function POST(_req: Request, context: { params: RouteParams | Promise<RouteParams> }) {
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
      return await handlePdfOrder(order, session);
    }

    // ─── Single-product business card order ───────────────────────────────────
    return await handleBusinessCardOrder(order, orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[jdf] error for order", orderId, err);
    return NextResponse.json({ error: message }, { status: 500 });
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
  const jdfStorageKey = `orders/${order!.referenceCode}/${jdfFileName}`;
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

async function handlePdfOrder(
  order: Awaited<ReturnType<typeof prisma.order.findUnique>> & {
    brand: any;
    template: any;
    pdfOrderItems: Array<{
      id: string;
      filename: string;
      sourceZipFilename: string | null;
      storagePath: string | null;
      pdfUrl: string | null;
      pdfFileName: string | null;
      quantity: number;
      trimWidthMm: number | null;
      trimHeightMm: number | null;
      pages: number | null;
      colorSpaces: string[];
      productFormat: { pcmCode: string | null; format: { trimWidthMm: number; trimHeightMm: number; name: string } } | null;
    }>;
  },
  session: any
) {
  const meta = typeof order!.meta === "object" && order!.meta ? (order!.meta as Record<string, unknown>) : {};
  const addressMeta = (meta.address as AddressMeta | undefined) ?? undefined;
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : undefined;

  const requesterContact = {
    company: addressMeta?.companyName?.trim() || order!.company?.split("\n")[0]?.trim() || order!.brand?.name || null,
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
        personName: order!.brand.contactName ?? session.user?.name ?? null,
        email: order!.brand.contactEmail ?? session.user?.email ?? null,
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

  const items = order!.pdfOrderItems;
  const itemCount = items.length;
  const jdfUrls: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemIndex = i + 1;

    // Ensure the individual PDF is extracted and available
    let pdfUrl = item.pdfUrl;
    let pdfFileName = item.pdfFileName;

    if (!pdfUrl && item.storagePath && item.sourceZipFilename) {
      const extracted = await extractAndUploadPdfItem({
        referenceCode: order!.referenceCode,
        archiveStorageKey: item.storagePath,
        archiveName: item.sourceZipFilename,
        originalFilename: item.filename,
      });
      pdfUrl = extracted.pdfUrl;
      pdfFileName = extracted.pdfFileName;
      await prisma.pdfOrderItem.update({
        where: { id: item.id },
        data: { pdfUrl, pdfFileName },
      });
    }

    if (!pdfUrl || !pdfFileName) {
      console.error(`[jdf] skipping item ${item.id} — no PDF URL available`);
      continue;
    }

    const pcmCode = item.productFormat?.pcmCode ?? null;
    const productName = item.productFormat?.format?.name ?? null;
    const trimWidthMm = item.trimWidthMm ?? item.productFormat?.format?.trimWidthMm ?? 210;
    const trimHeightMm = item.trimHeightMm ?? item.productFormat?.format?.trimHeightMm ?? 297;
    const pages = item.pages ?? 1;

    const jdfXml = buildPdfItemJdfDocument({
      referenceCode: order!.referenceCode,
      itemIndex,
      itemCount,
      pdfFileName,
      pdfUrl,
      originalFilename: item.filename,
      archiveName: item.sourceZipFilename ?? item.filename,
      pcmCode,
      productName,
      trimWidthMm,
      trimHeightMm,
      pages,
      quantity: item.quantity,
      colorSpaces: item.colorSpaces,
      brandName: order!.brand?.name ?? null,
      requester: requesterContact,
      administrator: administratorContact,
      deliveryAddress,
      customerReference,
      deliveryDueAt: order!.deliveryDueAt ?? undefined,
      createdAt: order!.createdAt ?? undefined,
    });

    // JDF filename mirrors the PDF filename
    const jdfFileName = pdfFileName.replace(/\.pdf$/i, ".jdf");
    const jdfStorageKey = `orders/${order!.referenceCode}/jdf/${jdfFileName}`;
    const jdfBlob = new Blob([jdfXml], { type: "application/xml" });
    const jdfUpload = await put(jdfStorageKey, jdfBlob, {
      access: "public",
      contentType: "application/xml",
      allowOverwrite: true,
    });
    jdfUrls.push(jdfUpload.url);

    // Upsert JdfExportJob for this item (keyed by pdfOrderItemId)
    const existingJob = await prisma.jdfExportJob.findUnique({
      where: { pdfOrderItemId: item.id },
    });
    if (existingJob) {
      await prisma.jdfExportJob.update({
        where: { id: existingJob.id },
        data: {
          pdfUrl,
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
          orderId: order!.id,
          pdfOrderItemId: item.id,
          pdfUrl,
          jdfXml,
          jdfUrl: jdfUpload.url,
          jdfFileName,
        },
      });
    }
  }

  // Store the first JDF URL on the order for quick reference
  if (jdfUrls.length > 0) {
    await prisma.order.update({
      where: { id: order!.id },
      data: {
        jdfUrl: jdfUrls[0],
        jdfFileName: `${order!.referenceCode}-${itemCount}-items.jdf`,
      },
    });
  }

  return NextResponse.json({
    jdfUrls,
    itemCount: jdfUrls.length,
  });
}
