import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";
import {
  escapeHtml,
  renderCtaButtonRow,
  renderEmailShell,
  renderGreetingIntroRow,
  type EmailCompanyInfo,
} from "@/lib/email-shell";

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
  company: EmailCompanyInfo;
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
    if (input.brandLabel) rows.push([t.brandLabel, input.brandLabel]);
    if (bc.templateLabel) rows.push([t.templateLabel, bc.templateLabel]);
    if (input.quantity != null) rows.push([t.quantityLabel, String(input.quantity)]);
    if (deliveryText) rows.push([t.deliveryDateLabel, deliveryText]);
    if (input.addressSummary) rows.push([t.shippingLabel, input.addressSummary]);
    if (input.customerReference) rows.push([t.customerReferenceLabel, input.customerReference]);

    bodyHtml += `
      <tr><td style="padding:20px 32px 0;">
        ${renderKeyValueTable(rows)}
      </td></tr>`;

    bodyText += `${t.cardHolderLabel}: ${bc.cardHolderName}\n`;
    if (input.brandLabel) bodyText += `${t.brandLabel}: ${input.brandLabel}\n`;
    if (bc.templateLabel) bodyText += `${t.templateLabel}: ${bc.templateLabel}\n`;
    if (input.quantity != null) bodyText += `${t.quantityLabel}: ${input.quantity}\n`;
    if (deliveryText) bodyText += `${t.deliveryDateLabel}: ${deliveryText}\n`;
    if (input.addressSummary) bodyText += `${t.shippingLabel}: ${input.addressSummary}\n`;
    if (input.customerReference) bodyText += `${t.customerReferenceLabel}: ${input.customerReference}\n`;
  } else {
    const { items } = input.order;
    // Uniform 56×56 square per thumbnail. Buffer is pre-normalised to a square PNG
    // (white padding, aspect-preserved) by the sender in lib/email.ts, so HTML layout
    // stays simple and renders consistently across clients that ignore object-fit.
    const THUMB_SIZE = 56;
    const itemRowsHtml = items
      .map((item, i) => {
        const boxStyle = `width:${THUMB_SIZE}px;height:${THUMB_SIZE}px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;display:block;`;
        let thumbHtml = `<div style="${boxStyle}"></div>`;
        if (item.thumbnailPngBuffer) {
          const contentId = `item-${i}`;
          attachments.push({
            Name: `item-${i + 1}.png`,
            Content: item.thumbnailPngBuffer.toString("base64"),
            ContentType: "image/png",
            ContentID: `cid:${contentId}`,
          });
          thumbHtml = `<img src="cid:${contentId}" alt="" width="${THUMB_SIZE}" height="${THUMB_SIZE}" style="${boxStyle}">`;
        }
        const meta = formatItemMeta(item, t, locale);
        return `
        <tr>
          <td width="${THUMB_SIZE + 16}" style="padding:8px 0;vertical-align:top;width:${THUMB_SIZE + 16}px;">${thumbHtml}</td>
          <td style="padding:8px 0 8px 16px;vertical-align:top;">
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

  const ctaHtml = input.orderUrl ? renderCtaButtonRow(t.viewOrderCta, input.orderUrl) : "";

  const contentHtml = `${renderGreetingIntroRow(greeting, t.intro)}${bodyHtml}${ctaHtml}`;

  const html = renderEmailShell({
    locale,
    subject,
    preheader,
    contentHtml,
    contactLine: t.contactLine,
    signoff: t.signoff,
    company: input.company,
  });

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

