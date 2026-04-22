import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";

export type OrderConfirmationAttachment = {
  Name: string;
  Content: string;
  ContentType: string;
  ContentID: string;
};

export type OrderConfirmationResult = {
  subject: string;
  html: string;
  text: string;
  attachments: OrderConfirmationAttachment[];
};

type BcOrderInput = {
  kind: "bc";
  cardHolderName: string;
  templateLabel: string | null;
  mockupPngBuffer: Buffer | null;
};

type UploadItem = {
  filename: string;
  quantity: number;
  pages: number | null;
  productName: string | null;
  formatLabel: string | null;
  thumbnailPngBuffer: Buffer | null;
};

type UploadOrderInput = {
  kind: "upload";
  items: UploadItem[];
};

export type OrderConfirmationInput = {
  locale: string | null;
  referenceCode: string;
  userName: string | null;
  quantity: number | null;
  brandLabel: string | null;
  deliveryDate: Date | null;
  addressSummary: string | null;
  customerReference: string | null;
  orderUrl: string | null;
  company: {
    name: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    logoUrl: string | null;
  };
  order: BcOrderInput | UploadOrderInput;
};

export function buildOrderConfirmation(input: OrderConfirmationInput): OrderConfirmationResult {
  const locale: Locale = isLocale(input.locale) ? input.locale : "de";
  const t = getTranslations(locale).email.orderConfirmation;
  const attachments: OrderConfirmationAttachment[] = [];

  const greeting = input.userName?.trim()
    ? t.greeting.replace("{name}", input.userName.trim())
    : t.greetingFallback;

  const subjectTemplate = input.order.kind === "bc" ? t.subjectBc : t.subjectUpload;
  const subject = `${input.company.name}: ${subjectTemplate.replace("{ref}", input.referenceCode)}`;
  const preheader = t.preheader.replace("{ref}", input.referenceCode);

  const deliveryText = input.deliveryDate ? formatDate(input.deliveryDate, locale) : null;

  // Header
  const headerHtml = input.company.logoUrl
    ? `<img src="${escapeAttr(input.company.logoUrl)}" alt="${escapeAttr(input.company.name)}" style="max-height:52px;width:auto;display:block;border:0;">`
    : `<div style="font-size:22px;font-weight:600;color:#111827;">${escapeHtml(input.company.name)}</div>`;

  const orderNumberCardHtml = `
      <tr><td style="padding:24px 32px 0;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
          <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">${escapeHtml(t.orderNumberLabel)}</div>
          <div style="font-size:20px;font-weight:600;color:#111827;margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.referenceCode)}</div>
        </div>
      </td></tr>`;

  // Body: either BC details or PDF item list
  let bodyHtml = "";
  let bodyText = "";

  if (input.order.kind === "bc") {
    const bc = input.order;

    if (bc.mockupPngBuffer) {
      const contentId = "mockup";
      attachments.push({
        Name: "mockup.png",
        Content: bc.mockupPngBuffer.toString("base64"),
        ContentType: "image/png",
        ContentID: `cid:${contentId}`,
      });
      bodyHtml += `
        <tr><td style="padding:8px 32px 0;" align="center">
          <img src="cid:${contentId}" alt="" style="max-width:100%;height:auto;display:block;border:0;">
        </td></tr>`;
    }

    bodyHtml += orderNumberCardHtml;

    const rows: Array<[string, string]> = [];
    rows.push([t.cardHolderLabel, bc.cardHolderName]);
    if (bc.templateLabel) rows.push([t.templateLabel, bc.templateLabel]);
    if (input.brandLabel) rows.push([t.brandLabel, input.brandLabel]);
    if (input.quantity != null) rows.push([t.quantityLabel, String(input.quantity)]);
    if (deliveryText) rows.push([t.deliveryDateLabel, deliveryText]);
    if (input.addressSummary) rows.push([t.shippingLabel, input.addressSummary]);
    if (input.customerReference) rows.push([t.customerReferenceLabel, input.customerReference]);

    bodyHtml += `
      <tr><td style="padding:20px 32px 0;">
        ${renderKeyValueTable(rows)}
      </td></tr>`;

    bodyText += `${t.cardHolderLabel}: ${bc.cardHolderName}\n`;
    if (bc.templateLabel) bodyText += `${t.templateLabel}: ${bc.templateLabel}\n`;
    if (input.brandLabel) bodyText += `${t.brandLabel}: ${input.brandLabel}\n`;
    if (input.quantity != null) bodyText += `${t.quantityLabel}: ${input.quantity}\n`;
    if (deliveryText) bodyText += `${t.deliveryDateLabel}: ${deliveryText}\n`;
    if (input.addressSummary) bodyText += `${t.shippingLabel}: ${input.addressSummary}\n`;
    if (input.customerReference) bodyText += `${t.customerReferenceLabel}: ${input.customerReference}\n`;
  } else {
    const { items } = input.order;
    const itemRowsHtml = items
      .map((item, i) => {
        let thumbHtml = `<div style="width:72px;height:72px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;"></div>`;
        if (item.thumbnailPngBuffer) {
          const contentId = `item-${i}`;
          attachments.push({
            Name: `item-${i + 1}.png`,
            Content: item.thumbnailPngBuffer.toString("base64"),
            ContentType: "image/png",
            ContentID: `cid:${contentId}`,
          });
          thumbHtml = `<img src="cid:${contentId}" alt="" width="72" height="72" style="display:block;border:1px solid #e5e7eb;border-radius:6px;object-fit:cover;">`;
        }
        const meta = formatItemMeta(item, t, locale);
        return `
        <tr>
          <td width="88" style="padding:10px 0;vertical-align:top;width:88px;">${thumbHtml}</td>
          <td style="padding:10px 0 10px 16px;vertical-align:top;">
            <div style="font-size:14px;font-weight:500;color:#111827;word-break:break-all;">${escapeHtml(item.filename)}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">${escapeHtml(meta)}</div>
          </td>
        </tr>`;
      })
      .join("");

    bodyHtml += `
      <tr><td style="padding:20px 32px 0;">
        <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;">${escapeHtml(t.itemsHeader)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${itemRowsHtml}
        </table>
      </td></tr>`;

    bodyHtml += orderNumberCardHtml;

    // Top-level details for upload orders
    const rows: Array<[string, string]> = [];
    if (input.brandLabel) rows.push([t.brandLabel, input.brandLabel]);
    if (deliveryText) rows.push([t.deliveryDateLabel, deliveryText]);
    if (input.addressSummary) rows.push([t.shippingLabel, input.addressSummary]);
    if (input.customerReference) rows.push([t.customerReferenceLabel, input.customerReference]);
    if (rows.length) {
      bodyHtml += `
      <tr><td style="padding:16px 32px 0;">
        ${renderKeyValueTable(rows)}
      </td></tr>`;
    }

    bodyText += `${t.itemsHeader}\n`;
    for (const item of items) {
      bodyText += `  - ${item.filename} (${formatItemMeta(item, t, locale)})\n`;
    }
    if (input.brandLabel) bodyText += `\n${t.brandLabel}: ${input.brandLabel}`;
    if (deliveryText) bodyText += `\n${t.deliveryDateLabel}: ${deliveryText}`;
    if (input.addressSummary) bodyText += `\n${t.shippingLabel}: ${input.addressSummary}`;
    if (input.customerReference) bodyText += `\n${t.customerReferenceLabel}: ${input.customerReference}`;
    bodyText += "\n";
  }

  const ctaHtml = input.orderUrl
    ? `
      <tr><td style="padding:28px 32px 36px;" align="center">
        <a href="${escapeAttr(input.orderUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(t.viewOrderCta)}</a>
      </td></tr>`
    : "";

  const companyAddressLine = [input.company.postalCode, input.company.city].filter(Boolean).join(" ");
  const footerLines = [
    input.company.name,
    input.company.street,
    companyAddressLine || null,
  ].filter(Boolean);
  const footerHtml = footerLines
    .map((line, i) => (i === 0
      ? `<strong style="color:#374151;">${escapeHtml(line!)}</strong>`
      : escapeHtml(line!)))
    .join("<br>");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<div style="display:none;max-height:0;overflow:hidden;visibility:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;border:1px solid #e5e7eb;">
      <tr><td style="padding:36px 32px 28px;">${headerHtml}</td></tr>
      <tr><td style="padding:0 32px;">
        <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#111827;">${escapeHtml(greeting)}</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563;">${escapeHtml(t.intro)}</p>
      </td></tr>
      ${bodyHtml}
      ${ctaHtml}
      <tr><td style="padding:28px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${escapeHtml(t.contactLine)}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          ${escapeHtml(t.signoff)},<br>
          ${footerHtml}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textLines = [
    greeting,
    "",
    t.intro,
    "",
    `${t.orderNumberLabel}: ${input.referenceCode}`,
    "",
    bodyText.trim(),
    "",
  ];
  if (input.orderUrl) {
    textLines.push(`${t.viewOrderCta}: ${input.orderUrl}`, "");
  }
  textLines.push(t.contactLine, "", `${t.signoff},`, input.company.name);
  const text = textLines.join("\n");

  return { subject, html, text, attachments };
}

function renderKeyValueTable(rows: Array<[string, string]>): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:40%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>`;
}

function formatItemMeta(
  item: UploadItem,
  t: ReturnType<typeof getTranslations>["email"]["orderConfirmation"],
  _locale: Locale,
): string {
  const parts: string[] = [];
  if (item.productName) parts.push(item.productName);
  if (item.formatLabel) parts.push(item.formatLabel);
  parts.push(`${item.quantity}×`);
  if (item.pages != null) {
    const template = item.pages === 1 ? t.itemPagesLabel : t.itemPagesLabelPlural;
    parts.push(template.replace("{count}", String(item.pages)));
  }
  return parts.join(" · ");
}

function formatDate(value: Date, locale: Locale): string {
  try {
    return value.toLocaleDateString(locale === "de" ? "de-AT" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
