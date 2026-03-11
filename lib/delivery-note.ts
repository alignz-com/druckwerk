import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DeliveryNoteOrder = {
  referenceCode: string;
  requesterName: string;
  requesterRole: string;
  customerReference?: string | null;
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
  const roleSize = 9;
  const commentSize = 9;
  const rowHeight = 16;
  const maxContentWidth = width - margin * 2;

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; pageRef?: typeof page; color?: ReturnType<typeof rgb> },
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
    targetPage.drawText(content, {
      x,
      y,
      size,
      font,
      color: options?.color ?? rgb(0.1, 0.1, 0.1),
    });
  };

  const wrapText = (text: string, maxWidth: number, size = bodySize) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    words.forEach((word) => {
      const tentative = current ? `${current} ${word}` : word;
      const width = bodyFont.widthOfTextAtSize(tentative, size);
      if (width <= maxWidth) {
        current = tentative;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [text];
  };

  const formatDate = new Intl.DateTimeFormat(payload.locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(payload.createdAt);

  let cursorY = height - margin;
  drawText("Order Confirmation", margin, cursorY, { size: titleSize, bold: true });
  cursorY -= 20;
  drawText(`Confirmation #: ${payload.deliveryNumber}`, margin, cursorY);
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
  const colName = margin + 100;
  const colTemplate = margin + 320;
  const colQty = width - margin - 40;

  const renderHeader = () => {
    drawText("Ref", colRef, cursorY, { bold: true });
    drawText("Name / Function", colName, cursorY, { bold: true });
    drawText("Template", colTemplate, cursorY, { bold: true });
    drawText("Qty", colQty, cursorY, { bold: true });
    cursorY -= rowHeight;
    // underline headers
    const headerLineY = cursorY - 4;
    page.drawLine({
      start: { x: margin, y: headerLineY },
      end: { x: width - margin, y: headerLineY },
      thickness: 0.6,
      color: rgb(0.85, 0.85, 0.85),
    });
    cursorY = headerLineY - 14;
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
    drawText(roleLine, colName, startY - rowHeight + 4, { size: roleSize });

    // Add extra spacing before the reference block to match the gap between name and role.
    const customerRefRaw = order.customerReference?.toString().trim() ?? "";
    const customerRef = customerRefRaw.replace(/^Kundenreferenz:\s*/i, "");

    // Base height for name + role block
    const baseHeight = rowHeight * 2 - 4; // tighten name/role stack
    let refHeight = 0;
    const lineHeightRef = commentSize + 1; // slightly tighter than default
    if (customerRef) {
      const refMaxWidth = colTemplate - colName - 12;
      const refLines = wrapText(`Comment: ${customerRef}`, refMaxWidth, commentSize);
      refHeight = refLines.length * (lineHeightRef + 1);
      let currentY = startY - baseHeight - 6;
      refLines.forEach((line) => {
        drawText(line, colName, currentY, { size: commentSize, color: rgb(0.45, 0.45, 0.45) });
        currentY -= lineHeightRef + 1;
      });
    }

    // Row separator with consistent spacing below content
    const rowBlockHeight = baseHeight + refHeight;
    const lineY = startY - rowBlockHeight - 10;
    page.drawLine({
      start: { x: margin, y: lineY },
      end: { x: width - margin, y: lineY },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    cursorY = lineY - 16; // add breathing room before next row
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}
