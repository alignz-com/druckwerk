import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCountryLabel } from "@/lib/countries";

type DeliveryNoteOrder = {
  referenceCode: string;
  templateLabel: string;
  brandName: string | null;
  quantity: number;
  requesterName: string;
  company: string | null;
  address?: {
    companyName?: string | null;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    countryCode?: string | null;
    addressExtra?: string | null;
  } | null;
};

type DeliveryNotePayload = {
  deliveryNumber: string;
  createdAt: Date;
  note?: string | null;
  locale: "en" | "de";
  orders: DeliveryNoteOrder[];
};

function formatAddress(address: DeliveryNoteOrder["address"], locale: "en" | "de") {
  if (!address) return "";
  const lines: string[] = [];
  const company = (address.companyName ?? "").trim();
  if (company) lines.push(company);
  const street = (address.street ?? "").trim();
  if (street) lines.push(street);
  const postalCity = [address.postalCode, address.city].filter(Boolean).join(" ").trim();
  if (postalCity) lines.push(postalCity);
  const country =
    address.countryCode && address.countryCode.length > 0
      ? getCountryLabel(locale, address.countryCode).trim()
      : "";
  if (country) lines.push(country);
  const extra = (address.addressExtra ?? "").trim();
  if (extra) lines.push(extra);
  return lines.join("\n");
}

export async function generateDeliveryNotePdf(payload: DeliveryNotePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4 in points
  const { height } = page.getSize();
  const margin = 40;
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const bodySize = 11;

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; pageRef?: typeof page },
  ) => {
    const font = options?.bold ? titleFont : bodyFont;
    const size = options?.size ?? bodySize;
    const targetPage = options?.pageRef ?? page;
    targetPage.drawText(text, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
  };

  const formatDate = new Intl.DateTimeFormat(payload.locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(payload.createdAt);

  let cursorY = height - margin;
  drawText("Delivery Note", margin, cursorY, { size: titleSize, bold: true });
  cursorY -= 20;
  drawText(`Delivery #: ${payload.deliveryNumber}`, margin, cursorY);
  cursorY -= 16;
  drawText(`Created: ${formatDate}`, margin, cursorY);

  cursorY -= 28;
  if (payload.note && payload.note.trim()) {
    drawText("Note:", margin, cursorY, { bold: true });
    cursorY -= 14;
    const noteLines = payload.note.split(/\r?\n/);
    noteLines.forEach((line) => {
      drawText(line, margin + 12, cursorY);
      cursorY -= 14;
    });
    cursorY -= 12;
  }

  drawText("Orders", margin, cursorY, { bold: true });
  cursorY -= 18;

  const headerY = cursorY;
  drawText("Ref", margin, headerY, { bold: true });
  drawText("Template", margin + 100, headerY, { bold: true });
  drawText("Brand", margin + 260, headerY, { bold: true });
  drawText("Qty", margin + 400, headerY, { bold: true });
  cursorY -= 14;

  payload.orders.forEach((order) => {
    if (cursorY < margin + 80) {
      // new page if needed
      const newPage = doc.addPage([595.28, 841.89]);
      page = newPage;
      cursorY = height - margin;
      drawText("Orders (continued)", margin, cursorY, { pageRef: page });
      cursorY -= 18;
    }
    drawText(order.referenceCode, margin, cursorY);
    drawText(order.templateLabel, margin + 100, cursorY);
    drawText(order.brandName ?? "–", margin + 260, cursorY);
    drawText(order.quantity.toString(), margin + 400, cursorY);
    cursorY -= 14;
    const addr = formatAddress(order.address, payload.locale);
    const companyLine = order.company?.trim();
    const lines: string[] = [];
    if (companyLine) lines.push(companyLine);
    if (addr) lines.push(addr);
    if (lines.length > 0) {
      lines.forEach((line) => {
        drawText(line, margin + 12, cursorY);
        cursorY -= 12;
      });
      cursorY -= 6;
    }
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}
