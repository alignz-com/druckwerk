import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DeliveryNoteOrder = {
  referenceCode: string;
  requesterName: string;
  requesterRole: string;
  templateLabel: string;
  brandName: string | null;
  quantity: number;
};

export type DeliveryNotePayload = {
  deliveryNumber: string;
  createdAt: Date;
  note?: string | null;
  locale: "en" | "de";
  shippingAddress?: string | null;
  orders: DeliveryNoteOrder[];
};

export async function generateDeliveryNotePdf(payload: DeliveryNotePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4 in points
  const { height, width } = page.getSize();
  const margin = 50;
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const titleSize = 18;
  const bodySize = 10;
  const rowHeight = 16;
  const maxContentWidth = width - margin * 2;

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; pageRef?: typeof page },
  ) => {
    const font = options?.bold ? titleFont : bodyFont;
    const size = options?.size ?? bodySize;
    const targetPage = options?.pageRef ?? page;
    const safeText = (text ?? "").replace(/\r?\n/g, " ");
    const trimmed = safeText.replace(/\s+/g, " ").trim();
    const maxWidth = maxContentWidth - x + margin;
    const textWidth = font.widthOfTextAtSize(trimmed, size);
    const content =
      textWidth > maxWidth
        ? font.widthOfTextAtSize(trimmed.slice(0, 40), size) > maxWidth
          ? trimmed.slice(0, 40)
          : trimmed.slice(0, Math.min(trimmed.length, 64))
        : trimmed;
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

  // Ship from block
  cursorY -= 24;
  drawText("Ship from:", margin, cursorY, { bold: true });
  cursorY -= 12;
  const shipFromLines = ["Thurnher Druckerei GmbH", "Grundweg 4", "6830 Rankweil", "AT"];
  shipFromLines.forEach((line) => {
    drawText(line, margin, cursorY);
    cursorY -= 12;
  });

  if (payload.shippingAddress && payload.shippingAddress.trim()) {
    cursorY -= 18;
    drawText("Ship to:", margin, cursorY, { bold: true });
    cursorY -= 12;
    const lines = payload.shippingAddress.split(/\r?\n/).filter((line) => line.trim().length > 0);
    lines.forEach((line) => {
      drawText(line, margin, cursorY);
      cursorY -= 12;
    });
  }

  cursorY -= 30;
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
  const colName = margin + 90;
  const colTemplate = margin + 310;
  const colQty = width - margin - 40;

  const renderHeader = () => {
    drawText("Ref", colRef, cursorY, { bold: true });
    drawText("Name / Function", colName, cursorY, { bold: true });
    drawText("Template", colTemplate, cursorY, { bold: true });
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
    const startY = cursorY;
    drawText(order.referenceCode, colRef, startY);
    drawText(order.requesterName, colName, startY);
    drawText(order.templateLabel, colTemplate, startY);
    drawText(order.quantity.toString(), colQty, startY);

    const roleLine = order.requesterRole && order.requesterRole.trim().length > 0 ? order.requesterRole : "–";
    drawText(roleLine, colName, startY - rowHeight + 4);

    cursorY -= rowHeight * 2 + 4;
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}
