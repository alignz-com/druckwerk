import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountryLabel } from "@/lib/countries";
import { generateOrderPdf } from "@/lib/orderPdf";
import { getTemplateByKey } from "@/lib/templates";
import { DELIVERY_OPTIONS } from "@/lib/delivery-options";
import { addBusinessDays } from "@/lib/date-utils";
import { buildJdfDocument } from "@/lib/jdf";
import { uploadJdfToPrinterFtp } from "@/lib/printer-ftp";

export const runtime = "nodejs";

const requestSchema = z.object({
  name: z.string().min(3),
  role: z.string().optional().default(""),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
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
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { brandId: true },
    });
    const effectiveBrandId = dbUser?.brandId ?? session.user.brandId ?? null;
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
    const templateDefinition = await getTemplateByKey(data.template, effectiveBrandId);
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

    const ftpResult = await uploadJdfToPrinterFtp(Buffer.from(jdfXml, "utf-8"), `${referenceCode}/${jdfFileName}`);

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
          jdfFtp: ftpResult,
        },
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, referenceCode }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Order API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
