/**
 * Generates one JDF per PdfOrderItem for a PDF print order.
 * Called automatically on order submission and on manual regeneration.
 */
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { put } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import { s3, ORDERS_BUCKET, S3_PUBLIC_URL } from "@/lib/s3";
import { buildPdfItemJdfDocument } from "@/lib/jdf";
import { extractAndUploadPdfItem } from "@/lib/pdf-item-extract";

type AddressMeta = {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  addressExtra?: string;
};

export async function generatePdfOrderJdfs(
  orderId: string,
  sessionUser?: { name?: string | null; email?: string | null }
): Promise<{ jdfUrls: string[]; itemCount: number }> {
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

  if (!order) throw new Error("Order not found");

  const meta = typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
  const addressMeta = (meta.address as AddressMeta | undefined) ?? undefined;
  const customerReference =
    typeof meta.customerReference === "string" || typeof meta.customerReference === "number"
      ? String(meta.customerReference)
      : undefined;

  const requesterContact = {
    company: addressMeta?.companyName?.trim() || order.company?.split("\n")[0]?.trim() || order.brand?.name || null,
    personName: order.requesterName ?? null,
    email: order.requesterEmail ?? null,
    phone: order.phone || null,
    mobile: order.mobile || null,
    street: addressMeta?.street ?? null,
    city: addressMeta?.city ?? null,
    postalCode: addressMeta?.postalCode ?? null,
    country: addressMeta?.country ?? null,
    countryCode: addressMeta?.countryCode ?? null,
  };

  const administratorContact = order.brand
    ? {
        company: order.brand.name,
        personName: order.brand.contactName ?? sessionUser?.name ?? null,
        email: order.brand.contactEmail ?? sessionUser?.email ?? null,
        phone: (order.brand as any).contactPhone ?? null,
      }
    : undefined;

  const deliveryAddress = addressMeta
    ? {
        companyName: addressMeta.companyName || order.company || order.brand?.name || undefined,
        street: addressMeta.street,
        postalCode: addressMeta.postalCode,
        city: addressMeta.city,
        country: addressMeta.country,
        countryCode: addressMeta.countryCode,
        addressExtra: addressMeta.addressExtra,
      }
    : undefined;

  const items = order.pdfOrderItems;
  const itemCount = items.length;
  const jdfUrls: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemIndex = i + 1;

    let pdfUrl = item.pdfUrl;

    if (!pdfUrl && item.storagePath && item.sourceZipFilename) {
      const extracted = await extractAndUploadPdfItem({
        referenceCode: order.referenceCode,
        archiveStorageKey: item.storagePath,
        archiveName: item.sourceZipFilename,
        originalFilename: item.filename,
      });
      pdfUrl = extracted.pdfUrl;
      await prisma.pdfOrderItem.update({
        where: { id: item.id },
        data: { pdfUrl, pdfFileName: extracted.pdfFileName },
      });
    }

    if (!pdfUrl) {
      console.error(`[generate-pdf-order-jdfs] skipping item ${item.id} — no PDF URL`);
      continue;
    }

    // Always derive canonical production filename: [order]-[archive]-[file]
    // This ensures consistent naming regardless of what was stored in the DB.
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/__+/g, "_").replace(/^_|_$/g, "");
    const sourceBase = safe(item.filename.replace(/\.pdf$/i, ""));
    const archivePart = item.sourceZipFilename ? `-${safe(item.sourceZipFilename.replace(/\.(7z|zip)$/i, ""))}` : "";
    const pdfFileName = `${safe(order.referenceCode)}${archivePart}-${sourceBase}.pdf`;

    // Rename the PDF in MinIO to the canonical production name if it isn't already.
    // Staging items land at {ref}/pdf/{n}-{name} — copy to {ref}/pdfs/{canonical}, then
    // delete the original so there are no duplicates.
    const s3Base = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}`;
    const canonicalStorageKey = `${order.referenceCode}/pdfs/${pdfFileName}`;
    const canonicalPdfUrl = `${s3Base}/${canonicalStorageKey}`;

    if (pdfUrl !== canonicalPdfUrl && pdfUrl.startsWith(`${s3Base}/`)) {
      const sourceKey = pdfUrl.replace(`${s3Base}/`, "");
      try {
        await s3.send(new CopyObjectCommand({
          Bucket: ORDERS_BUCKET,
          CopySource: `${ORDERS_BUCKET}/${sourceKey}`,
          Key: canonicalStorageKey,
        }));
        await s3.send(new DeleteObjectCommand({ Bucket: ORDERS_BUCKET, Key: sourceKey }));
        await prisma.pdfOrderItem.update({
          where: { id: item.id },
          data: { pdfUrl: canonicalPdfUrl, pdfFileName },
        });
        pdfUrl = canonicalPdfUrl;
      } catch (err) {
        console.error(`[generate-pdf-order-jdfs] failed to rename PDF for item ${item.id}:`, err);
        // Continue with original URL — JDF will still reference the correct file
      }
    }

    const pcmCode = item.productFormat?.pcmCode ?? null;
    const productName = item.productFormat?.format?.name ?? null;
    const trimWidthMm = item.trimWidthMm ?? item.productFormat?.format?.trimWidthMm ?? 210;
    const trimHeightMm = item.trimHeightMm ?? item.productFormat?.format?.trimHeightMm ?? 297;
    const pages = item.pages ?? 1;

    const jdfXml = buildPdfItemJdfDocument({
      referenceCode: order.referenceCode,
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
      brandName: order.brand?.name ?? null,
      requester: requesterContact,
      administrator: administratorContact,
      deliveryAddress,
      customerReference,
      deliveryDueAt: order.deliveryDueAt ?? undefined,
      createdAt: order.createdAt ?? undefined,
    });

    const jdfFileName = pdfFileName.replace(/\.pdf$/i, ".jdf");
    const jdfStorageKey = `${order.referenceCode}/jdf/${jdfFileName}`;
    const jdfBlob = new Blob([jdfXml], { type: "application/xml" });
    const jdfUpload = await put(jdfStorageKey, jdfBlob, {
      access: "public",
      contentType: "application/xml",
      allowOverwrite: true,
    });
    jdfUrls.push(jdfUpload.url);

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
          orderId: order.id,
          pdfOrderItemId: item.id,
          pdfUrl,
          jdfXml,
          jdfUrl: jdfUpload.url,
          jdfFileName,
        },
      });
    }
  }

  if (jdfUrls.length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        jdfUrl: jdfUrls[0],
        jdfFileName: `${order.referenceCode}-${itemCount}-items.jdf`,
      },
    });
  }

  return { jdfUrls, itemCount: jdfUrls.length };
}
