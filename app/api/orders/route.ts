import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountryLabel } from "@/lib/countries";
import { generateOrderPdf } from "@/lib/orderPdf";
import { getTemplateByKey } from "@/lib/templates";

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

function buildReferenceCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().slice(0, 4).toUpperCase();
  return `OC-${stamp}-${random}`;
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

    const localeShort = session.user.locale === "de" ? "de" : "en";
    const addressMeta = data.address
      ? {
          ...data.address,
          country: data.address.countryCode ? getCountryLabel(localeShort, data.address.countryCode) : undefined,
        }
      : undefined;
    const templateDefinition = await getTemplateByKey(data.template, effectiveBrandId);

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

    const referenceCode = buildReferenceCode();
    const fileName = `orders/${session.user.id}/${referenceCode}.pdf`;
    const pdfBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const upload = await put(fileName, pdfBlob, {
      access: "public",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const order = await prisma.order.create({
      data: {
        referenceCode,
        userId: session.user.id,
        brandId: effectiveBrandId,
        templateId: templateDefinition.id ?? null,
        quantity: data.quantity,
        deliveryTime: data.deliveryTime,
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
        meta: {
          templateKey: data.template,
          ...(data.customerReference ? { customerReference: data.customerReference } : {}),
          ...(addressMeta ? { address: addressMeta } : {}),
          ...(fontReport?.length ? { fontReport } : {}),
        },
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, referenceCode }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Order API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
