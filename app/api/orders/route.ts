import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderPdf } from "@/lib/orderPdf";

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
  deliveryTime: z.string().min(1),
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

    const { pdfBytes, fontReport } = await generateOrderPdf({
      name: data.name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      company: data.company,
      url: data.url,
      template: data.template,
    });

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
        brandId: session.user.brandId ?? null,
        templateId: data.template,
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
        meta: fontReport?.length ? { fontReport } : null,
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, referenceCode }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Order API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Interner Fehler" }, { status: 500 });
  }
}
