import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountryLabel } from "@/lib/countries";
import { generateOrderPdf } from "@/lib/orderPdf";
import { getTemplateForBrandOrGlobal } from "@/lib/templates";
import { DELIVERY_OPTIONS } from "@/lib/delivery-options";
import { addBusinessDays } from "@/lib/date-utils";
import { buildJdfDocument } from "@/lib/jdf";
import { uploadJdfToPrinterFtp } from "@/lib/printer-ftp";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getBrandsForUser } from "@/lib/brand-access";

export const runtime = "nodejs";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

const requestSchema = z.object({
  name: z.string().min(3),
  role: z.string().optional().default(""),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  brandId: z.string().optional().nullable(),
  template: z.string().optional().default("omicron"),
  quantity: z.number().int().positive(),
  deliveryTime: z.enum(["express", "standard"]),
  customerReference: z.string().optional().default(""),
  address: z
    .object({
      companyName: z.string().optional().default(""),
      street: z.string().optional().default(""),
      postalCode: z.string().optional().default(""),
      city: z.string().optional().default(""),
      countryCode: z.string().optional().default(""),
      addressExtra: z.string().optional().default(""),
    })
    .optional(),
});

function formatReferenceCode(year: number, sequence: number) {
  return `${year}-${sequence.toString().padStart(5, "0")}`;
}

async function reserveReferenceCode() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const counter = await prisma.$transaction((tx) =>
    tx.orderReferenceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    }),
  );
  const sequence = counter.lastValue;
  return {
    referenceCode: formatReferenceCode(year, sequence),
    referenceYear: year,
    referenceSequence: sequence,
  };
}

function sanitizeFileComponent(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return normalized || fallback;
}

function buildFileBaseName(brandName: string | null | undefined, requesterName: string) {
  const brand = sanitizeFileComponent(brandName ?? "Brand", "Brand").replace(/\s+/g, "_");
  const requester = sanitizeFileComponent(requesterName, "Requester").replace(/\s+/g, "_");
  return `BC-${brand}-${requester}`;
}

function toStorageKey(referenceCode: string, baseName: string, extension: string) {
  const safeSegment = baseName.replace(/\s+/g, "_") || referenceCode;
  return `orders/${referenceCode}/${safeSegment}.${extension}`;
}

function formatAddressSummary(address?: {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  addressExtra?: string;
}) {
  if (!address) return undefined;
  const lines = [
    address.companyName,
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.country,
  ]
    .filter((part) => !!part && part.trim().length > 0)
    .map((part) => part?.trim());
  if (!lines.length) return undefined;
  return lines.join(", ");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Eingaben", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const requestedBrandId = data.brandId?.trim() || null;
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { brandId: true },
    });
    const brandOptions = await getBrandsForUser({
      userId: session.user.id,
      role: session.user.role ?? "USER",
      knownBrandId: dbUser?.brandId ?? session.user.brandId ?? null,
    });
    let effectiveBrandId = dbUser?.brandId ?? session.user.brandId ?? null;
    if (requestedBrandId) {
      if (!brandOptions.some((brand) => brand.id === requestedBrandId)) {
        return NextResponse.json({ error: "Brand not allowed" }, { status: 403 });
      }
      effectiveBrandId = requestedBrandId;
    } else if (!effectiveBrandId && brandOptions.length === 1) {
      effectiveBrandId = brandOptions[0]?.id ?? null;
    }
    const brand = effectiveBrandId
      ? await prisma.brand.findUnique({
          where: { id: effectiveBrandId },
          select: { name: true, contactName: true, contactEmail: true, contactPhone: true },
        })
      : null;

    const localeShort = session.user.locale === "de" ? "de" : "en";
    const addressMeta = data.address
      ? {
          ...data.address,
          country: data.address.countryCode ? getCountryLabel(localeShort, data.address.countryCode) : undefined,
        }
      : undefined;
    const templateDefinition = await getTemplateForBrandOrGlobal(data.template, effectiveBrandId);
    const deliveryConfig = DELIVERY_OPTIONS[data.deliveryTime] ?? DELIVERY_OPTIONS.standard;
    const deliveryDueAt = addBusinessDays(new Date(), deliveryConfig.businessDays);

    const { pdfBytes, fontReport } = await generateOrderPdf(
      {
        name: data.name,
        role: data.role,
        email: data.email,
        phone: data.phone,
        mobile: data.mobile,
        company: data.company,
        url: data.url,
        linkedin: data.linkedin,
        address: addressMeta,
      },
      templateDefinition,
    );

    const { referenceCode, referenceYear, referenceSequence } = await reserveReferenceCode();
    const fileBaseName = buildFileBaseName(brand?.name, data.name);
    const pdfFileName = `${fileBaseName}.pdf`;
    const fileName = toStorageKey(referenceCode, fileBaseName, "pdf");
    const pdfBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const upload = await put(fileName, pdfBlob, {
      access: "public",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const requesterCompany = data.address?.companyName?.trim() || data.company?.split("\n")[0]?.trim() || brand?.name || null;
    const requesterContact = {
      company: requesterCompany,
      personName: data.name,
      email: data.email,
      phone: data.phone || null,
      mobile: data.mobile || null,
      street: addressMeta?.street ?? null,
      city: addressMeta?.city ?? null,
      postalCode: addressMeta?.postalCode ?? null,
      country: addressMeta?.country ?? null,
      countryCode: addressMeta?.countryCode ?? null,
    };

    const administratorContact = brand
      ? {
          company: brand.name,
          personName: brand.contactName ?? session.user.name ?? null,
          email: brand.contactEmail ?? session.user.email ?? null,
          phone: brand.contactPhone ?? null,
        }
      : undefined;

    const deliveryAddress = addressMeta
      ? {
          companyName: addressMeta.companyName || data.company || brand?.name || undefined,
          street: addressMeta.street,
          postalCode: addressMeta.postalCode,
          city: addressMeta.city,
          country: addressMeta.country,
          countryCode: addressMeta.countryCode,
          addressExtra: addressMeta.addressExtra,
        }
      : undefined;

    const jdfXml = buildJdfDocument({
      referenceCode,
      templateKey: data.template,
      pcmCode: templateDefinition.pcmCode ?? null,
      brandName: brand?.name,
      requester: requesterContact,
      administrator: administratorContact,
      deliveryAddress,
      quantity: data.quantity,
      pdfUrl: upload.url,
      pdfFileName,
      customerReference: data.customerReference || undefined,
      deliveryDueAt,
      createdAt: new Date(),
      paperStock: templateDefinition.paperStock ?? undefined,
    });

    const jdfFileName = `${referenceCode}.jdf`;
    const jdfStorageKey = toStorageKey(referenceCode, referenceCode, "jdf");
    const jdfBlob = new Blob([jdfXml], { type: "application/xml" });
    const jdfUpload = await put(jdfStorageKey, jdfBlob, {
      access: "public",
      contentType: "application/xml",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const order = await prisma.order.create({
      data: {
        referenceCode,
        referenceYear,
        referenceSequence,
        userId: session.user.id,
        brandId: effectiveBrandId,
        templateId: templateDefinition.id ?? null,
        quantity: data.quantity,
        deliveryTime: data.deliveryTime,
        deliveryDueAt,
        status: "SUBMITTED",
        requesterName: data.name,
        requesterRole: data.role || null,
        requesterEmail: data.email,
        phone: data.phone || null,
        mobile: data.mobile || null,
        company: data.company || null,
        url: data.url || null,
        linkedin: data.linkedin || null,
        pdfUrl: upload.url,
        blobId: upload.pathname ?? upload.url,
        pdfFileName,
        jdfUrl: jdfUpload.url,
        jdfBlobId: jdfUpload.pathname ?? jdfUpload.url,
        jdfFileName,
        meta: {
          templateKey: data.template,
          ...(data.customerReference ? { customerReference: data.customerReference } : {}),
          ...(addressMeta ? { address: addressMeta } : {}),
          ...(fontReport?.length ? { fontReport } : {}),
          jdfFtp: { status: "scheduled" },
        },
      },
    });

    scheduleJdfFtpUpload({ orderId: order.id, jdfXml, jdfFileName });

    const addressSummary = formatAddressSummary(addressMeta);
    const orderUrl = APP_URL ? `${APP_URL}/orders?detail=${encodeURIComponent(order.id)}` : undefined;
    const recipients: Array<{ to: string; userName: string | null | undefined }> = [];
    if (session.user.email) {
      recipients.push({ to: session.user.email, userName: session.user.name });
    }
    recipients.push({ to: "webshop@dth.at", userName: null });

    await Promise.allSettled(
      recipients.map(({ to, userName }) =>
        sendOrderConfirmationEmail({
          to,
          userName,
          referenceCode,
          cardHolderName: data.name,
          quantity: data.quantity,
          templateLabel: templateDefinition.label,
          brandLabel: brand?.name ?? null,
          deliveryDate: deliveryDueAt,
          addressSummary,
          orderUrl,
          customerReference: data.customerReference || null,
        }),
      ),
    );

    return NextResponse.json({ success: true, orderId: order.id, referenceCode }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Order API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}

function scheduleJdfFtpUpload({ orderId, jdfXml, jdfFileName }: { orderId: string; jdfXml: string; jdfFileName: string }) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  void (async () => {
    try {
      await sleep(5000);
      const ftpResult = await uploadJdfToPrinterFtp(Buffer.from(jdfXml, "utf-8"), jdfFileName);
      const currentMeta = await prisma.order.findUnique({ where: { id: orderId }, select: { meta: true } });
      await prisma.order.update({
        where: { id: orderId },
        data: {
          meta: {
            ...((currentMeta?.meta as Record<string, unknown> | null) ?? {}),
            jdfFtp: ftpResult,
          },
        },
      });
      if (ftpResult.status !== "uploaded") {
        console.error("[order] JDF FTP upload failed", ftpResult);
      }
    } catch (error) {
      console.error("[order] background JDF FTP upload error", error);
      const currentMeta = await prisma.order.findUnique({ where: { id: orderId }, select: { meta: true } });
      await prisma.order.update({
        where: { id: orderId },
        data: {
          meta: {
            ...((currentMeta?.meta as Record<string, unknown> | null) ?? {}),
            jdfFtp: { status: "failed", error: error instanceof Error ? error.message : String(error) },
          },
        },
      });
    }
  })();
}
