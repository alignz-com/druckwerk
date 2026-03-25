import { NextResponse } from "next/server";
import { put } from "@/lib/blob";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountryLabel } from "@/lib/countries";
import { generateOrderPdf } from "@/lib/orderPdf";
import { getTemplateForBrandOrGlobal } from "@/lib/templates";
import { DELIVERY_OPTIONS } from "@/lib/delivery-options";
import { addBusinessDays } from "@/lib/date-utils";
import { buildJdfDocument } from "@/lib/jdf";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getBrandsForUser } from "@/lib/brand-access";
import { normalizeWebUrl } from "@/lib/normalize-url";
import { saveUserOrderProfile } from "@/lib/user-order-profile";
import { resolveAllowedQuantities } from "@/lib/order-quantities";

export const runtime = "nodejs";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

async function generateOrderThumbnail(pdfBytes: Uint8Array): Promise<Buffer | null> {
  const id = randomUUID();
  const pdfPath = join(tmpdir(), `${id}.pdf`);
  const thumbBase = join(tmpdir(), `${id}-thumb`);
  const thumbPath = `${thumbBase}.png`;
  try {
    await writeFile(pdfPath, pdfBytes);
    const DPI = 150;
    const scale = DPI / 72;
    const args = ["-png", "-r", String(DPI), "-singlefile"];

    // Read TrimBox directly from the PDF for accurate cropping
    const { PDFDocument, PDFName } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    const mediaBox = page.getMediaBox();
    let trimBox: { x: number; y: number; width: number; height: number } | null = null;
    try {
      trimBox = page.getTrimBox();
    } catch { /* no TrimBox */ }

    if (trimBox && (trimBox.width < mediaBox.width || trimBox.height < mediaBox.height)) {
      // pdftocairo uses top-left origin; TrimBox uses bottom-left
      const px = Math.round(trimBox.x * scale);
      const py = Math.round((mediaBox.height - trimBox.y - trimBox.height) * scale);
      const pw = Math.round(trimBox.width * scale);
      const ph = Math.round(trimBox.height * scale);
      args.push("-x", String(px), "-y", String(py), "-W", String(pw), "-H", String(ph));
    }

    args.push(pdfPath, thumbBase);
    await execFileAsync("pdftocairo", args);
    return await readFile(thumbPath);
  } catch {
    return null;
  } finally {
    await unlink(pdfPath).catch(() => {});
    await unlink(thumbPath).catch(() => {});
  }
}

const requestSchema = z.object({
  name: z.string().min(3),
  role: z.string().optional().default(""),
  seniority: z.string().optional().default(""),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  photoUrl: z.string().url().optional(),
  brandId: z.string().optional().nullable(),
  template: z.string().min(1, "template is required"),
  quantity: z.number().int().positive(),
  deliveryTime: z.enum(["express", "standard"]),
  customerReference: z.string().optional().default(""),
  qrMode: z.enum(["vcard", "public"]).optional(),
  draftContactId: z.string().optional(),
  addressId: z.string().optional().nullable(),
  addressLabel: z.string().optional().nullable(),
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
  thumbnailBase64: z.string().optional(),
  thumbnailBackBase64: z.string().optional(),
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
  return `${referenceCode}/${safeSegment}.${extension}`;
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

    // Demo users: skip all DB writes and return a fake success
    if ((session.user as any).isDemo) {
      const fakeRef = `DEMO-${Date.now().toString(36).toUpperCase()}`;
      return NextResponse.json({ success: true, orderId: "demo", referenceCode: fakeRef }, { status: 201 });
    }

    const data = parsed.data;
    const rawUrl = data.url?.trim() ?? "";
    const rawLinkedin = data.linkedin?.trim() ?? "";
    const rawPhotoUrl = data.photoUrl?.trim() ?? "";
    const normalizedUrl = normalizeWebUrl(rawUrl);
    const normalizedLinkedin = normalizeWebUrl(rawLinkedin);
    const normalizedPhotoUrl = rawPhotoUrl || null;
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
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            qrMode: true,
            defaultQrMode: true,
            quantityMin: true,
            quantityMax: true,
            quantityStep: true,
            quantityOptions: true,
          },
        })
      : null;

    const allowedQuantities = resolveAllowedQuantities(brand ?? undefined);
    if (!allowedQuantities.includes(data.quantity)) {
      return NextResponse.json({ error: "Invalid quantity selection" }, { status: 400 });
    }

    const templateDefinition = await getTemplateForBrandOrGlobal(data.template, effectiveBrandId);
    if (!templateDefinition) {
      return NextResponse.json({ error: "Template is missing PDF asset" }, { status: 422 });
    }
    const templateHasQrCode = Boolean(templateDefinition.hasQrCode);
    const localeShort = session.user.locale === "de" ? "de" : "en";
    const normalizedAddressId = templateHasQrCode ? data.addressId?.trim() || null : null;
    const normalizedAddressLabel = templateHasQrCode ? data.addressLabel?.trim() ?? "" : "";
    const structuredAddress = templateHasQrCode ? data.address : undefined;
    const addressMeta = structuredAddress
      ? {
          ...structuredAddress,
          country: structuredAddress.countryCode ? getCountryLabel(localeShort, structuredAddress.countryCode) : undefined,
        }
      : undefined;
    const deliveryConfig = DELIVERY_OPTIONS[data.deliveryTime] ?? DELIVERY_OPTIONS.standard;
    const deliveryDueAt = addBusinessDays(new Date(), deliveryConfig.businessDays);

    const requestedQrMode = data.qrMode === "public" ? "public" : "vcard";
    const brandQrMode = brand?.qrMode ?? "VCARD_ONLY";
    const defaultQrMode = brand?.defaultQrMode ?? "VCARD_ONLY";
    const draftContactId = data.draftContactId?.trim() || null;
    const resolvedQrMode =
      brandQrMode === "PUBLIC_PROFILE_ONLY"
        ? "public"
        : brandQrMode === "BOTH"
          ? requestedQrMode === "public"
            ? "public"
            : defaultQrMode === "PUBLIC_PROFILE_ONLY"
              ? "public"
              : "vcard"
          : "vcard";

    let qrPayload: string | null = null;
    let contactId: string | null = null;
    let publicProfileUrl: string | null = null;
    if (templateHasQrCode && resolvedQrMode === "public") {
      if (!effectiveBrandId) {
        return NextResponse.json({ error: "Brand is required for public QR mode" }, { status: 400 });
      }
      const fallbackDomain = process.env.VCARD_FALLBACK_DOMAIN || "druckwerk.dth.at";
      const brandDomain = brand?.id
        ? await prisma.brandPublicDomain.findFirst({
            where: { brandId: brand.id },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          })
        : null;

      const [firstName, ...lastParts] = data.name.trim().split(/\s+/);
      const lastName = lastParts.join(" ").trim();
      const host = brandDomain?.domain?.trim() || fallbackDomain;
      if (draftContactId) {
        const updated = await prisma.contact.updateMany({
          where: {
            id: draftContactId,
            brandId: brand?.id ?? effectiveBrandId,
            status: "DRAFT",
          },
          data: {
            status: "CONFIRMED",
            expiresAt: null,
            firstName: firstName || data.name,
            lastName: lastName || "",
            title: data.role || null,
            department: data.seniority || null,
            email: data.email || null,
            phone: data.phone || null,
            mobile: data.mobile || null,
            website: rawUrl || null,
            linkedin: templateHasQrCode ? rawLinkedin || null : null,
            photoUrl: normalizedPhotoUrl,
            addressId: normalizedAddressId,
          },
        });
        if (updated.count > 0) {
          const draft = await prisma.contact.findUnique({
            where: { id: draftContactId },
            select: { id: true, publicId: true },
          });
          if (draft) {
            contactId = draft.id;
            publicProfileUrl = `https://${host}/${draft.publicId}`;
            qrPayload = publicProfileUrl;
          }
        }
      }
      if (!contactId) {
        const publicId = randomBytes(10).toString("base64url");
        const contact = await prisma.contact.create({
          data: {
            publicId,
            brandId: brand?.id ?? effectiveBrandId,
            status: "CONFIRMED",
            expiresAt: null,
            firstName: firstName || data.name,
            lastName: lastName || "",
            title: data.role || null,
            department: data.seniority || null,
            email: data.email || null,
            phone: data.phone || null,
            mobile: data.mobile || null,
            website: rawUrl || null,
            linkedin: templateHasQrCode ? rawLinkedin || null : null,
            photoUrl: normalizedPhotoUrl,
            addressId: normalizedAddressId,
          },
        });
        contactId = contact.id;
        publicProfileUrl = `https://${host}/${contact.publicId}`;
        qrPayload = publicProfileUrl;
      }
    }

    const { pdfBytes, fontReport } = await generateOrderPdf(
      {
        name: data.name,
        role: data.role,
        seniority: data.seniority,
        email: data.email,
        phone: data.phone,
        mobile: data.mobile,
        company: data.company,
        url: rawUrl,
        linkedin: templateHasQrCode ? rawLinkedin : "",
        address: addressMeta,
        qrPayload,
        photoUrl: normalizedPhotoUrl || undefined,
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
    });

    const requesterCompany =
      structuredAddress?.companyName?.trim() || data.company?.split("\n")[0]?.trim() || brand?.name || null;
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
        requesterSeniority: data.seniority || null,
        requesterEmail: data.email,
        phone: data.phone || null,
        mobile: data.mobile || null,
        company: data.company || null,
        url: normalizedUrl || null,
        linkedin: templateHasQrCode ? normalizedLinkedin || null : null,
        photoOriginalUrl: normalizedPhotoUrl,
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
          ...(templateHasQrCode ? { qrMode: resolvedQrMode } : {}),
          ...(contactId ? { contactId } : {}),
          ...(publicProfileUrl ? { publicProfileUrl } : {}),
        },
      },
    });

    await prisma.jdfExportJob.create({
      data: {
        orderId: order.id,
        pdfUrl: upload.url,
        jdfXml,
      },
    });

    // Store thumbnails — prefer client-provided SVG capture, fall back to PDF rendering
    try {
      let thumbBuffer: Buffer | null = null;
      if (data.thumbnailBase64) {
        thumbBuffer = Buffer.from(data.thumbnailBase64, "base64");
      } else {
        thumbBuffer = await generateOrderThumbnail(pdfBytes);
      }

      const updateData: Record<string, string> = {};

      if (thumbBuffer) {
        const thumbKey = toStorageKey(referenceCode, fileBaseName, "thumb.png");
        const thumbBlob = new Blob([new Uint8Array(thumbBuffer)], { type: "image/png" });
        const thumbUpload = await put(thumbKey, thumbBlob, {
          access: "public",
          contentType: "image/png",
        });
        updateData.thumbnailUrl = thumbUpload.url;
      }

      // Store back thumbnail if provided
      if (data.thumbnailBackBase64) {
        const backBuffer = Buffer.from(data.thumbnailBackBase64, "base64");
        const backKey = toStorageKey(referenceCode, fileBaseName, "thumb-back.png");
        const backBlob = new Blob([new Uint8Array(backBuffer)], { type: "image/png" });
        const backUpload = await put(backKey, backBlob, {
          access: "public",
          contentType: "image/png",
        });
        updateData.thumbnailBackUrl = backUpload.url;
      }

      // Generate mockup composite from front + back
      if (thumbBuffer && data.thumbnailBackBase64) {
        try {
          const { generateCardMockup } = await import("@/lib/card-mockup");
          const backBuffer = Buffer.from(data.thumbnailBackBase64, "base64");
          const mockupBuffer = await generateCardMockup(thumbBuffer, backBuffer);
          const mockupKey = toStorageKey(referenceCode, fileBaseName, "mockup.png");
          const mockupBlob = new Blob([new Uint8Array(mockupBuffer)], { type: "image/png" });
          const mockupUpload = await put(mockupKey, mockupBlob, {
            access: "public",
            contentType: "image/png",
          });
          updateData.mockupUrl = mockupUpload.url;
        } catch (mockupErr) {
          console.error("[orders] mockup generation failed:", mockupErr);
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.order.update({
          where: { id: order.id },
          data: updateData,
        });
      }
    } catch (err) {
      console.error("[orders] thumbnail generation failed:", err);
    }

    if (effectiveBrandId) {
      await saveUserOrderProfile({
        userId: session.user.id,
        brandId: effectiveBrandId,
        data: {
          name: data.name,
          jobTitle: data.role,
          seniority: data.seniority,
          email: data.email,
          phone: data.phone,
          mobile: data.mobile,
          url: rawUrl,
          linkedin: templateHasQrCode ? rawLinkedin : undefined,
          addressId: templateHasQrCode ? normalizedAddressId : undefined,
          addressLabel: templateHasQrCode ? normalizedAddressLabel : undefined,
          companyName: templateHasQrCode ? structuredAddress?.companyName ?? null : undefined,
          street: templateHasQrCode ? structuredAddress?.street ?? null : undefined,
          postalCode: templateHasQrCode ? structuredAddress?.postalCode ?? null : undefined,
          city: templateHasQrCode ? structuredAddress?.city ?? null : undefined,
          countryCode: templateHasQrCode ? structuredAddress?.countryCode ?? null : undefined,
          addressBlock: data.company ?? null,
        },
      });
    }

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
