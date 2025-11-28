import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DeliveryNoteOrder = {
  referenceCode: string;
  requesterName: string;
  templateLabel: string;
  brandName: string | null;
  quantity: number;
};

export type DeliveryNotePayload = {
  deliveryNumber: string;
  createdAt: Date;
  note?: string | null;
  locale: "en" | "de";
  orders: DeliveryNoteOrder[];
};

export async function generateDeliveryNotePdf(payload: DeliveryNotePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4 in points
  const { height } = page.getSize();
  const margin = 40;
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const bodySize = 11;
  const rowHeight = 18;
  const maxContentWidth = 595.28 - margin * 2;

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; pageRef?: typeof page },
  ) => {
    const font = options?.bold ? titleFont : bodyFont;
    const size = options?.size ?? bodySize;
    const targetPage = options?.pageRef ?? page;
    const safeText = text ?? "";
    const trimmed = safeText.replace(/\s+/g, " ").trim();
    const maxWidth = maxContentWidth - x + margin;
    const textWidth = font.widthOfTextAtSize(trimmed, size);
    const content = textWidth > maxWidth ? font.widthOfTextAtSize(trimmed.slice(0, 40), size) > maxWidth ? trimmed.slice(0, 40) : trimmed.slice(0, Math.min(trimmed.length, 64)) : trimmed;
    targetPage.drawText(content, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
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

  const colRef = margin;
  const colName = margin + 110;
  const colTemplate = margin + 250;
  const colBrand = margin + 420;
  const colQty = margin + 520;

  const renderHeader = () => {
    drawText("Ref", colRef, cursorY, { bold: true });
    drawText("Name", colName, cursorY, { bold: true });
    drawText("Template", colTemplate, cursorY, { bold: true });
    drawText("Brand", colBrand, cursorY, { bold: true });
    drawText("Qty", colQty, cursorY, { bold: true });
    cursorY -= rowHeight;
  };

  renderHeader();

  payload.orders.forEach((order) => {
    if (cursorY < margin + 60) {
      page = doc.addPage([595.28, 841.89]);
      cursorY = height - margin;
      drawText("Orders (continued)", margin, cursorY, { pageRef: page });
      cursorY -= rowHeight;
      renderHeader();
    }
    drawText(order.referenceCode, colRef, cursorY);
    drawText(order.requesterName, colName, cursorY);
    drawText(order.templateLabel, colTemplate, cursorY);
    drawText(order.brandName ?? "–", colBrand, cursorY);
    drawText(order.quantity.toString(), colQty, cursorY);
    cursorY -= rowHeight;
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}
