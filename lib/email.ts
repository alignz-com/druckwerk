import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { S3_PUBLIC_URL, ORDERS_BUCKET } from "@/lib/s3";
import {
  buildOrderConfirmation,
  type OrderConfirmationInput,
} from "@/lib/order-confirmation-email";
import { buildPasswordResetEmail } from "@/lib/password-reset-email";

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const PRODUCT_NAME = process.env.APP_PRODUCT_NAME || process.env.NEXT_PUBLIC_APP_NAME || "druckwerk";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

export type PasswordResetEmailPayload = {
  to: string;
  name?: string | null;
  resetUrl: string;
  locale?: string | null;
  operatingSystem?: string | null;
  browserName?: string | null;
};

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  locale,
  operatingSystem,
  browserName,
}: PasswordResetEmailPayload) {
  const apiToken = process.env.POSTMARK_API_TOKEN;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";

  if (!apiToken || !fromEmail) {
    console.warn("[email] Missing Postmark configuration, skipping password reset email");
    return;
  }

  const settings = await getSystemSettings();
  const built = buildPasswordResetEmail({
    locale: locale ?? null,
    userName: name ?? null,
    resetUrl,
    operatingSystem: operatingSystem ?? null,
    browserName: browserName ?? null,
    productName: PRODUCT_NAME,
    company: {
      name: settings.companyName,
      street: settings.street,
      postalCode: settings.postalCode,
      city: settings.city,
      logoUrl: settings.logoUrl,
    },
  });

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: fromEmail,
      To: to,
      Subject: built.subject,
      HtmlBody: built.html,
      TextBody: built.text,
      MessageStream: messageStream,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[email] Failed to send password reset email", response.status, body);
  }
}

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const apiToken = process.env.POSTMARK_API_TOKEN;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";

  if (!apiToken || !fromEmail) {
    console.warn("[email] Missing Postmark configuration, skipping order confirmation");
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        brand: true,
        template: true,
        pdfOrderItems: {
          orderBy: { createdAt: "asc" },
          include: {
            productFormat: { include: { product: true, format: true } },
          },
        },
      },
    });
    if (!order || !order.user?.email) {
      console.warn(`[email] Order ${orderId} not found or missing user email, skipping confirmation`);
      return;
    }

    const settings = await getSystemSettings();
    const locale = order.user.locale ?? null;

    const customerReference =
      order.meta && typeof order.meta === "object" && !Array.isArray(order.meta)
        ? (order.meta as Record<string, unknown>).customerReference
        : null;

    const orderUrl = APP_URL ? `${APP_URL}/orders?detail=${encodeURIComponent(order.id)}` : null;

    let input: OrderConfirmationInput;
    if (order.type === "UPLOAD") {
      const items = await Promise.all(
        order.pdfOrderItems.map(async (item) => {
          const thumbUrl = item.thumbnailStoragePath
            ? `${S3_PUBLIC_URL}/${ORDERS_BUCKET}/${item.thumbnailStoragePath}`
            : null;
          const rawThumb = thumbUrl ? await fetchAsBuffer(thumbUrl) : null;
          const thumb = rawThumb ? await normalizeThumbnailToSquare(rawThumb) : null;
          const productName = pickLocalized(
            locale,
            item.productFormat?.product?.nameEn,
            item.productFormat?.product?.nameDe,
            item.productFormat?.product?.name ?? null,
          );
          const formatLabel = pickLocalized(
            locale,
            item.productFormat?.format?.name ?? null,
            item.productFormat?.format?.nameDe,
            null,
          );
          return {
            filename: item.filename,
            quantity: item.quantity,
            pages: item.pages,
            productName,
            formatLabel,
            thumbnailPngBuffer: thumb,
          };
        }),
      );
      input = {
        locale,
        referenceCode: order.referenceCode,
        userName: order.user.name,
        quantity: null,
        brandLabel: order.brand?.name ?? null,
        deliveryDate: order.deliveryDueAt ?? null,
        addressSummary: null,
        customerReference: typeof customerReference === "string" ? customerReference : null,
        orderUrl,
        company: {
          name: settings.companyName,
          street: settings.street,
          postalCode: settings.postalCode,
          city: settings.city,
          logoUrl: settings.logoUrl,
        },
        order: { kind: "upload", items },
      };
    } else {
      const mockup = order.mockupUrl ? await fetchAsBuffer(order.mockupUrl) : null;
      const templateLabel = order.template?.label ?? null;
      const cardHolderName = order.requesterName ?? "";
      input = {
        locale,
        referenceCode: order.referenceCode,
        userName: order.user.name,
        quantity: order.quantity,
        brandLabel: order.brand?.name ?? null,
        deliveryDate: order.deliveryDueAt ?? null,
        addressSummary: null,
        customerReference: typeof customerReference === "string" ? customerReference : null,
        orderUrl,
        company: {
          name: settings.companyName,
          street: settings.street,
          postalCode: settings.postalCode,
          city: settings.city,
          logoUrl: settings.logoUrl,
        },
        order: { kind: "bc", cardHolderName, templateLabel, mockupPngBuffer: mockup },
      };
    }

    const built = buildOrderConfirmation(input);

    const response = await fetch(POSTMARK_API_URL, {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: fromEmail,
        To: order.user.email,
        Bcc: settings.emailBcc || undefined,
        Subject: built.subject,
        HtmlBody: built.html,
        TextBody: built.text,
        Attachments: built.attachments.length ? built.attachments : undefined,
        MessageStream: messageStream,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[email] Failed to send order confirmation", response.status, body);
    }
  } catch (err) {
    console.error("[email] sendOrderConfirmation error:", err);
  }
}

// Resize a PDF-item thumbnail to a fixed square (2× retina of the rendered size)
// with white padding, preserving aspect ratio. Produces visually uniform rows
// even in email clients that ignore CSS object-fit.
async function normalizeThumbnailToSquare(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .resize(112, 112, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn("[email] thumbnail normalize failed", err);
    return buffer;
  }
}

async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[email] fetch ${url} → ${res.status}`);
      return null;
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch (err) {
    console.warn(`[email] fetch ${url} failed`, err);
    return null;
  }
}

function pickLocalized(
  locale: string | null,
  en: string | null | undefined,
  de: string | null | undefined,
  fallback: string | null,
): string | null {
  const isGerman = locale?.toLowerCase().startsWith("de");
  const primary = isGerman ? de : en;
  return primary?.trim() || en?.trim() || de?.trim() || fallback?.trim() || null;
}

