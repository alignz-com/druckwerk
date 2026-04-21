import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { s3, FONT_BUCKET } from "@/lib/s3";
import { getSystemSettings } from "@/lib/system-settings";
import { getCountryLabel } from "@/lib/countries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryNotePdfItem = {
  filename: string;
  quantity: number;
  pages: number | null;
  productName: string | null;
  formatName: string | null;
  coverPaper: string | null;
  contentPaper: string | null;
  finishName: string | null;
};

export type DeliveryNoteOrder = {
  referenceCode: string;
  requesterName: string;
  requesterRole: string;
  customerReference?: string | null;
  brandName: string | null;
  quantity: number;
  deliveryTime: string;
  type: "TEMPLATE" | "UPLOAD";
  templateLabel?: string;
  productName?: string | null;
  pdfOrderItems?: DeliveryNotePdfItem[];
};

export type DeliveryNotePayload = {
  deliveryNumber: string;
  /** "AB" = Auftragsbestätigung (default), "LS" = Lieferschein */
  documentType?: "AB" | "LS";
  createdAt: Date;
  note?: string | null;
  locale: "en" | "de";
  shippingAddress?: string | null;
  orders: DeliveryNoteOrder[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const A4_W = 595.28;
const A4_H = 841.89;
const MM_TO_PT = 2.83465;

// Defaults when no letterhead / safe area configured
const DEFAULT_MARGIN = 50;
const DEFAULT_TOP = 50;
const DEFAULT_BOTTOM = 50;

const TITLE_SIZE = 14;
const HEADING_SIZE = 11;
const BODY_SIZE = 9.5;
const SMALL_SIZE = 8.5;
const COL_HEADER_SIZE = 7;
const ROW_HEIGHT = 14;
const EXPRESS_COLOR = rgb(0.75, 0.1, 0.1);
const HEADER_COLOR = rgb(0.15, 0.15, 0.15);
const BODY_COLOR = rgb(0.2, 0.2, 0.2);
const MUTED_COLOR = rgb(0.45, 0.45, 0.45);
const LINE_COLOR = rgb(0.85, 0.85, 0.85);

// ---------------------------------------------------------------------------
// Font loading
// ---------------------------------------------------------------------------

async function loadConfirmationFonts(doc: PDFDocument) {
  const settings = await getSystemSettings();
  const slug = settings.confirmationFontFamily;

  if (slug) {
    try {
      const family = await prisma.fontFamily.findUnique({
        where: { slug },
        include: { variants: true },
      });

      if (family) {
        doc.registerFontkit(fontkit);

        const embeddable = (v: { format: string }) => v.format === "TTF" || v.format === "OTF";
        const isNormal = (v: { style: string | null }) => {
          const s = v.style?.toUpperCase();
          return s === "NORMAL" || !s;
        };
        const isItalic = (v: { style: string | null }) => v.style?.toUpperCase() === "ITALIC";

        const regularVariant = family.variants.find(
          (v) => v.weight === 400 && isNormal(v) && embeddable(v),
        ) ?? family.variants.find(
          (v) => v.weight === 400 && !isItalic(v) && embeddable(v),
        );

        const boldVariant = family.variants.find(
          (v) => v.weight === 700 && isNormal(v) && embeddable(v),
        ) ?? family.variants.find(
          (v) => v.weight === 700 && !isItalic(v) && embeddable(v),
        ) ?? family.variants.find(
          (v) => v.weight >= 600 && !isItalic(v) && embeddable(v),
        );

        const loadVariant = async (variant: { storageKey: string }) => {
          const res = await s3.send(
            new GetObjectCommand({ Bucket: FONT_BUCKET, Key: variant.storageKey }),
          );
          const bytes = await res.Body?.transformToByteArray();
          if (!bytes) throw new Error("Empty font data");
          const font = await doc.embedFont(bytes, { subset: true });
          void font.widthOfTextAtSize("ÄÖÜ äöü ß", 10);
          return font;
        };

        if (regularVariant && boldVariant) {
          const [regular, bold] = await Promise.all([
            loadVariant(regularVariant),
            loadVariant(boldVariant),
          ]);
          return { regular, bold };
        }

        if (regularVariant) {
          const regular = await loadVariant(regularVariant);
          return { regular, bold: regular };
        }
      }
    } catch (err) {
      console.warn("[delivery-note] Failed to load custom font, falling back to Helvetica:", err);
    }
  }

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { regular, bold };
}

// ---------------------------------------------------------------------------
// Letterhead loading
// ---------------------------------------------------------------------------

async function loadLetterhead(settings: Awaited<ReturnType<typeof getSystemSettings>>) {
  if (!settings.letterheadUrl) return null;
  try {
    const res = await fetch(settings.letterheadUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return PDFDocument.load(bytes);
  } catch (err) {
    console.warn("[delivery-note] Failed to load letterhead PDF:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Logo loading (fallback when no letterhead)
// ---------------------------------------------------------------------------

async function loadLogo(doc: PDFDocument, logoUrl: string | null): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return doc.embedPng(bytes);
    return doc.embedJpg(bytes);
  } catch (err) {
    console.warn("[delivery-note] Failed to load logo:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const safe = (text ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let t = safe;
  while (t.length > 1 && font.widthOfTextAtSize(t + "\u2026", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "\u2026";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export async function generateDeliveryNotePdf(payload: DeliveryNotePayload): Promise<Uint8Array> {
  const settings = await getSystemSettings();
  const letterheadDoc = await loadLetterhead(settings);
  const hasLetterhead = Boolean(letterheadDoc);

  const doc = await PDFDocument.create();
  doc.setProducer("Druckwerk");
  doc.setCreator("Druckwerk");

  const fonts = await loadConfirmationFonts(doc);

  // Safe area from settings (in points), with fallbacks
  const safeLeft = (settings.safeLeftMm ?? DEFAULT_MARGIN / MM_TO_PT) * MM_TO_PT;
  const safeRight = (settings.safeRightMm ?? DEFAULT_MARGIN / MM_TO_PT) * MM_TO_PT;
  const safeTop = (settings.safeTopMm ?? DEFAULT_TOP / MM_TO_PT) * MM_TO_PT;
  const safeBottom = (settings.safeBottomMm ?? DEFAULT_BOTTOM / MM_TO_PT) * MM_TO_PT;

  // Address window from settings (in points)
  const addrX = (settings.addressWindowXMm ?? 25) * MM_TO_PT;
  const addrY = (settings.addressWindowYMm ?? 50) * MM_TO_PT;
  const addrW = (settings.addressWindowWidthMm ?? 80) * MM_TO_PT;
  const addrH = (settings.addressWindowHeightMm ?? 35) * MM_TO_PT;

  const contentW = A4_W - safeLeft - safeRight;

  // --- State ---
  let page: PDFPage;
  let cursorY: number;

  const isDE = payload.locale === "de";
  const labels = {
    title: payload.documentType === "LS"
      ? (isDE ? "Lieferschein" : "Delivery Note")
      : (isDE ? "Auftragsbest\u00e4tigung" : "Order Confirmation"),
    brand: isDE ? "Marke" : "Brand",
    note: isDE ? "Anmerkung" : "Note",
    businessCards: isDE ? "Visitenkarten" : "Business Cards",
    printJobs: isDE ? "Druckauftr\u00e4ge" : "Print Jobs",
    ref: isDE ? "Bestellnummer" : "Order No.",
    nameRole: isDE ? "Name / Funktion" : "Name / Role",
    product: isDE ? "Produkt" : "Product",
    template: isDE ? "Vorlage" : "Template",
    file: isDE ? "Datei" : "File",
    qty: isDE ? "Menge" : "Qty",
    express: "EXPRESS",
    continued: isDE ? "(Fortsetzung)" : "(continued)",
    format: "Format",
    pages: isDE ? "Seiten" : "Pages",
    paper: isDE ? "Papier" : "Paper",
    finish: isDE ? "Veredelung" : "Finish",
    comment: isDE ? "Kommentar" : "Comment",
  };

  const formatDate = new Intl.DateTimeFormat(isDE ? "de-AT" : "en-GB", {
    dateStyle: "medium",
  }).format(payload.createdAt);

  // --- Drawing helpers ---
  const draw = (
    text: string,
    x: number,
    y: number,
    opts?: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; maxWidth?: number },
  ) => {
    const f = opts?.font ?? fonts.regular;
    const s = opts?.size ?? BODY_SIZE;
    const mw = opts?.maxWidth ?? contentW - (x - safeLeft);
    const content = truncate(text, f, s, mw);
    page.drawText(content, { x, y, size: s, font: f, color: opts?.color ?? BODY_COLOR });
  };

  const hLine = (y: number) => {
    page.drawLine({
      start: { x: safeLeft, y },
      end: { x: A4_W - safeRight, y },
      thickness: 0.5,
      color: LINE_COLOR,
    });
  };

  // Add a new page — either from letterhead or blank
  const addPage = async (): Promise<PDFPage> => {
    if (letterheadDoc) {
      const [tplPage] = await doc.copyPages(letterheadDoc, [0]);
      doc.addPage(tplPage);
      return tplPage;
    }
    return doc.addPage([A4_W, A4_H]);
  };

  const ensureSpace = async (needed: number) => {
    if (cursorY - needed < safeBottom) {
      page = await addPage();
      cursorY = A4_H - safeTop;
    }
  };

  // =========================================================================
  // FIRST PAGE
  // =========================================================================

  page = await addPage();
  cursorY = A4_H - safeTop;

  // --- Address window (recipient) ---
  if (payload.shippingAddress?.trim()) {
    const lines = payload.shippingAddress.split(/\r?\n/).filter((l) => l.trim()).map((line) => {
      // Convert 2-letter country codes to full names
      if (/^[A-Z]{2}$/.test(line.trim())) {
        return getCountryLabel(isDE ? "de" : "en", line.trim());
      }
      return line;
    });
    let addrCursorY = A4_H - addrY;
    for (const line of lines) {
      if (addrCursorY < A4_H - addrY - addrH) break;
      draw(line, addrX, addrCursorY, { size: BODY_SIZE, maxWidth: addrW });
      addrCursorY -= ROW_HEIGHT;
    }
  }

  // --- If no letterhead, draw header with logo ---
  if (!hasLetterhead) {
    const logo = await loadLogo(doc, settings.logoUrl);
    const logoMaxH = 36;
    const logoMaxW = 100;

    if (logo) {
      const aspect = logo.width / logo.height;
      let drawH = logoMaxH;
      let drawW = drawH * aspect;
      if (drawW > logoMaxW) { drawW = logoMaxW; drawH = drawW / aspect; }
      page.drawImage(logo, {
        x: safeLeft,
        y: cursorY - drawH,
        width: drawW,
        height: drawH,
      });
    }

    // Company info top-right
    const companyLines = [
      settings.companyName,
      settings.street,
      [settings.postalCode, settings.city].filter(Boolean).join(" "),
      settings.countryCode,
    ].filter((l): l is string => Boolean(l?.trim()));

    let infoY = cursorY;
    for (const line of companyLines) {
      const w = fonts.regular.widthOfTextAtSize(line, SMALL_SIZE);
      draw(line, A4_W - safeRight - w, infoY, { size: SMALL_SIZE, color: MUTED_COLOR });
      infoY -= ROW_HEIGHT;
    }

    cursorY -= logoMaxH + 16;
  }

  // --- Title block ---
  // Content must start below the address window (with 10mm gap) AND below the safe top
  const ADDR_GAP = 10 * MM_TO_PT; // 10mm gap below address window
  const belowAddrWindow = A4_H - addrY - addrH - ADDR_GAP;
  cursorY = Math.min(cursorY, belowAddrWindow);

  // City + date, left-aligned
  const cityName = settings.city ?? "";
  const cityDate = [cityName, formatDate].filter(Boolean).join(", ");
  draw(cityDate, safeLeft, cursorY, { size: BODY_SIZE, color: MUTED_COLOR });
  cursorY -= 32;

  // Title
  draw(`${labels.title} ${payload.deliveryNumber}`, safeLeft, cursorY, {
    font: fonts.bold, size: TITLE_SIZE, color: HEADER_COLOR,
  });
  cursorY -= 32;

  // Note
  if (payload.note?.trim()) {
    draw(`${labels.note}: ${payload.note}`, safeLeft, cursorY, { size: BODY_SIZE, color: MUTED_COLOR, maxWidth: contentW });
    cursorY -= ROW_HEIGHT + 4;
  }

  // =========================================================================
  // BUSINESS CARDS (template orders)
  // =========================================================================

  const templateOrders = payload.orders.filter((o) => o.type === "TEMPLATE");

  if (templateOrders.length > 0) {
    const colRef = safeLeft;
    const colQty = safeLeft + 80;
    const colProduct = safeLeft + 115;
    const colName = safeLeft + 220;
    const colBrandTpl = safeLeft + 370;

    draw(labels.businessCards, safeLeft, cursorY, { font: fonts.bold, size: HEADING_SIZE, color: HEADER_COLOR });
    cursorY -= 18;

    draw(labels.ref.toUpperCase(), colRef, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.qty.toUpperCase(), colQty, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.product.toUpperCase(), colProduct, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.nameRole.toUpperCase(), colName, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(`${labels.brand} / ${labels.template}`.toUpperCase(), colBrandTpl, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    cursorY -= 6;
    hLine(cursorY);
    cursorY -= ROW_HEIGHT;

    for (let oi = 0; oi < templateOrders.length; oi++) {
      const order = templateOrders[oi];
      await ensureSpace(50);
      const rowY = cursorY;

      // Row 1: main content
      draw(order.referenceCode, colRef, rowY, { size: BODY_SIZE });
      draw(order.quantity.toString(), colQty, rowY, { size: BODY_SIZE });
      draw(order.productName ?? "\u2013", colProduct, rowY, { size: BODY_SIZE, maxWidth: colName - colProduct - 8 });
      draw(order.requesterName, colName, rowY, { size: BODY_SIZE, maxWidth: colBrandTpl - colName - 8 });

      const brandTpl = [order.brandName, order.templateLabel].filter(Boolean).join(" / ");
      const brandTplMaxW = contentW - (colBrandTpl - safeLeft);
      const brandTplLines = wrapText(brandTpl || "\u2013", fonts.regular, BODY_SIZE, brandTplMaxW);
      brandTplLines.forEach((line, i) => {
        draw(line, colBrandTpl, rowY - i * ROW_HEIGHT, { size: BODY_SIZE });
      });
      cursorY -= ROW_HEIGHT;

      // Row 2: role + express (if any)
      const hasExpress = order.deliveryTime === "express";
      const role = order.requesterRole?.trim();
      if (hasExpress || role || brandTplLines.length > 1) {
        if (hasExpress) draw(labels.express, colRef, cursorY, { font: fonts.bold, size: 7, color: EXPRESS_COLOR });
        if (role) draw(role, colName, cursorY, { size: SMALL_SIZE, color: MUTED_COLOR });
        cursorY -= ROW_HEIGHT;
      }

      // Extra brand wrap lines
      if (brandTplLines.length > 2) cursorY -= ROW_HEIGHT * (brandTplLines.length - 2);

      // Customer reference
      const customerRef = order.customerReference?.replace(/^Kundenreferenz:\s*/i, "").trim();
      if (customerRef) {
        const refLines = wrapText(`${labels.comment}: ${customerRef}`, fonts.regular, SMALL_SIZE, colBrandTpl - colName - 8);
        for (const line of refLines) {
          draw(line, colName, cursorY, { size: SMALL_SIZE, color: MUTED_COLOR });
          cursorY -= ROW_HEIGHT;
        }
      }

      // Separator: same pattern as header line — line at cursorY, then gap
      if (oi < templateOrders.length - 1) {
        hLine(cursorY);
        cursorY -= ROW_HEIGHT;
      }
    }

    cursorY -= 20;
  }

  // =========================================================================
  // PRINT JOBS (upload orders)
  // =========================================================================

  const uploadOrders = payload.orders.filter((o) => o.type === "UPLOAD");

  if (uploadOrders.length > 0) {
    const colRef = safeLeft;
    const colQty = safeLeft + 80;
    const colProduct = safeLeft + 110;
    const colFormat = safeLeft + 175;
    const colPages = safeLeft + 230;
    const colFile = safeLeft + 260;

    await ensureSpace(60);

    draw(labels.printJobs, safeLeft, cursorY, { font: fonts.bold, size: HEADING_SIZE, color: HEADER_COLOR });
    cursorY -= 18;

    draw(labels.ref.toUpperCase(), colRef, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.qty.toUpperCase(), colQty, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.product.toUpperCase(), colProduct, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.format.toUpperCase(), colFormat, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.pages.toUpperCase(), colPages, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    draw(labels.file.toUpperCase(), colFile, cursorY, { size: COL_HEADER_SIZE, color: MUTED_COLOR });
    cursorY -= 6;
    hLine(cursorY);
    cursorY -= ROW_HEIGHT;

    for (let oi = 0; oi < uploadOrders.length; oi++) {
      const order = uploadOrders[oi];
      const items = order.pdfOrderItems ?? [];
      const hasExpress = order.deliveryTime === "express";
      const customerRef = order.customerReference?.replace(/^Kundenreferenz:\s*/i, "").trim();

      await ensureSpace(40);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowY = cursorY;

        if (i === 0) {
          draw(order.referenceCode, colRef, rowY, { size: BODY_SIZE });
        }

        draw(item.quantity.toString(), colQty, rowY, { size: BODY_SIZE });
        draw(item.productName ?? "\u2013", colProduct, rowY, { size: BODY_SIZE, maxWidth: colFormat - colProduct - 6 });
        draw(item.formatName ?? "\u2013", colFormat, rowY, { size: BODY_SIZE, maxWidth: colPages - colFormat - 6 });
        draw(item.pages != null ? String(item.pages) : "\u2013", colPages, rowY, { size: BODY_SIZE });
        draw(item.filename, colFile, rowY, { size: BODY_SIZE, maxWidth: contentW - (colFile - safeLeft) });

        cursorY -= ROW_HEIGHT;

        if (i === 0 && hasExpress) {
          draw(labels.express, colRef, cursorY, { font: fonts.bold, size: 7, color: EXPRESS_COLOR });
          cursorY -= ROW_HEIGHT;
        }
      }

      if (customerRef) {
        draw(`${labels.comment}: ${customerRef}`, colProduct, cursorY, { size: SMALL_SIZE, color: MUTED_COLOR, maxWidth: contentW - (colProduct - safeLeft) });
        cursorY -= ROW_HEIGHT;
      }

      // Separator between orders (not after last)
      if (oi < uploadOrders.length - 1) {
        hLine(cursorY);
        cursorY -= ROW_HEIGHT;
      }
    }
  }

  const pdfBytes = await doc.save();
  return pdfBytes;
}

// ---------------------------------------------------------------------------
// Shared helpers for API routes
// ---------------------------------------------------------------------------

export function formatLieferscheinNumber(sequence: number) {
  return `LS-${sequence.toString().padStart(5, "0")}`;
}

export async function reserveLieferscheinNumber() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const counter = await prisma.$transaction((tx) =>
    tx.lieferscheinReferenceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    }),
  );
  return formatLieferscheinNumber(counter.lastValue);
}

/** Prisma include for fetching a delivery with all data needed for PDF generation */
export const deliveryPdfInclude = {
  items: {
    orderBy: { position: "asc" as const },
    include: {
      order: {
        include: {
          brand: { select: { name: true } },
          template: {
            select: {
              label: true,
              key: true,
              product: { select: { name: true, nameEn: true, nameDe: true } },
            },
          },
          pdfOrderItems: {
            orderBy: { createdAt: "asc" as const },
            include: {
              productFormat: {
                include: {
                  product: { select: { name: true, nameEn: true, nameDe: true } },
                  format: { select: { name: true, nameDe: true } },
                },
              },
              coverPaperStock: { select: { name: true } },
              contentPaperStock: { select: { name: true } },
              finish: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} as const;

/** Build a DeliveryNotePayload from a fetched delivery record */
export function buildDeliveryNotePayload(
  delivery: any,
  locale: "en" | "de",
  opts?: { documentType?: "AB" | "LS"; numberOverride?: string },
): DeliveryNotePayload {
  const isDE = locale === "de";
  const pn = (p: { name: string; nameEn?: string | null; nameDe?: string | null } | null | undefined) =>
    p ? (isDE ? p.nameDe : p.nameEn) ?? p.name : null;
  const fn = (f: { name: string; nameDe?: string | null } | null | undefined) =>
    f ? (isDE ? f.nameDe : null) ?? f.name : null;

  const shippingAddress = [
    delivery.shippingCompany,
    delivery.shippingStreet,
    delivery.shippingAddressExtra,
    [delivery.shippingPostalCode, delivery.shippingCity].filter(Boolean).join(" ").trim(),
    delivery.shippingCountryCode,
  ]
    .filter((line: unknown) => line && String(line).trim().length > 0)
    .join("\n");

  const items = delivery.items ?? [];

  return {
    deliveryNumber: opts?.numberOverride ?? delivery.number,
    documentType: opts?.documentType,
    createdAt: delivery.createdAt,
    note: delivery.note,
    locale,
    shippingAddress,
    orders: items.map(({ order }: any) => {
      const base = {
        referenceCode: order.referenceCode,
        requesterName: order.requesterName ?? "",
        requesterRole: order.requesterRole ?? "",
        customerReference:
          typeof order.meta === "object" && order.meta && "customerReference" in order.meta
            ? order.meta.customerReference ?? null
            : null,
        brandName: order.brand?.name ?? null,
        deliveryTime: order.deliveryTime ?? "standard",
      };

      if (order.type === "UPLOAD") {
        return {
          ...base,
          type: "UPLOAD" as const,
          quantity: (order.pdfOrderItems ?? []).reduce((sum: number, i: any) => sum + i.quantity, 0),
          pdfOrderItems: (order.pdfOrderItems ?? []).map((item: any) => ({
            filename: item.filename,
            quantity: item.quantity,
            pages: item.pages,
            productName: pn(item.productFormat?.product),
            formatName: fn(item.productFormat?.format),
            coverPaper: item.coverPaperStock?.name ?? null,
            contentPaper: item.contentPaperStock?.name ?? null,
            finishName: item.finish?.name ?? null,
          })),
        };
      }

      return {
        ...base,
        type: "TEMPLATE" as const,
        templateLabel: order.template?.label ?? order.template?.key ?? "–",
        productName: pn(order.template?.product),
        quantity: order.quantity ?? 0,
      };
    }),
  };
}
