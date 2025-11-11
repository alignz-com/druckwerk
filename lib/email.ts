const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const PRODUCT_NAME = process.env.APP_PRODUCT_NAME || process.env.NEXT_PUBLIC_APP_NAME || "druckwerk";
const SUPPORT_URL =
  process.env.SUPPORT_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://druckwerk.dth.at";

export type PasswordResetEmailPayload = {
  to: string;
  name?: string | null;
  resetUrl: string;
  locale?: string | null;
  operatingSystem?: string | null;
  browserName?: string | null;
};

export type OrderConfirmationEmailPayload = {
  to: string;
  userName?: string | null;
  referenceCode: string;
  cardHolderName: string;
  quantity: number;
  templateLabel?: string | null;
  paperStockName?: string | null;
  deliveryDate?: Date | string | null;
  addressSummary?: string | null;
  orderUrl?: string | null;
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

  const isGerman = locale?.toLowerCase().startsWith("de");
  const namePart = name?.trim() ? ` ${name.trim()}` : "";
  const osInfo = operatingSystem || "Unknown OS";
  const browserInfo = browserName || "Unknown browser";

  const subject = isGerman ? `${PRODUCT_NAME}: Passwort zurücksetzen` : `${PRODUCT_NAME}: Reset your password`;
  const textBody = isGerman
    ? `Hallo${namePart},

du hast angefordert, dein Passwort für ${PRODUCT_NAME} zurückzusetzen. Öffne den folgenden Link (24 Stunden gültig):

${resetUrl}

Anfrage von Gerät: ${osInfo} / ${browserInfo}. Wenn du das nicht warst, ignoriere diese Nachricht oder kontaktiere uns unter ${SUPPORT_URL}.

Viele Grüße
${PRODUCT_NAME} Support`
    : `Hi${namePart},

You requested to reset your ${PRODUCT_NAME} password. Use this link (valid for 24 hours):

${resetUrl}

Request originated from: ${osInfo} / ${browserInfo}. If you didn’t make it, ignore this message or reach us at ${SUPPORT_URL}.

Thanks,
${PRODUCT_NAME} Support`;

  const htmlBody = isGerman
    ? `<p>Hallo${namePart},</p>
<p>du hast angefordert, dein Passwort für ${PRODUCT_NAME} zurückzusetzen. Der Link gilt für 24&nbsp;Stunden.</p>
<p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Passwort zurücksetzen</a></p>
<p>Gerät: ${osInfo} / ${browserInfo}. Warst du das nicht? Ignoriere die E-Mail oder kontaktiere uns unter <a href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">${SUPPORT_URL}</a>.</p>
<p>Viele Grüße<br/>${PRODUCT_NAME} Support</p>`
    : `<p>Hi${namePart},</p>
<p>You requested to reset your ${PRODUCT_NAME} password. The link is valid for 24&nbsp;hours.</p>
<p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset password</a></p>
<p>Device: ${osInfo} / ${browserInfo}. Didn’t make this request? Ignore this email or contact us at <a href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">${SUPPORT_URL}</a>.</p>
<p>Thanks,<br/>${PRODUCT_NAME} Support</p>`;

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: fromEmail,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: messageStream,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[email] Failed to send password reset email", response.status, body);
  }
}

export async function sendOrderConfirmationEmail({
  to,
  userName,
  referenceCode,
  cardHolderName,
  quantity,
  templateLabel,
  paperStockName,
  deliveryDate,
  addressSummary,
  orderUrl,
}: OrderConfirmationEmailPayload) {
  const apiToken = process.env.POSTMARK_API_TOKEN;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";

  if (!apiToken || !fromEmail) {
    console.warn("[email] Missing Postmark configuration, skipping order confirmation email");
    return;
  }

  const greetingName = userName?.trim() || "";
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";

  const details = [
    `Order ID: ${referenceCode}`,
    `Business card for: ${cardHolderName}`,
    `Quantity: ${quantity}`,
  ];
  if (templateLabel) details.push(`Template: ${templateLabel}`);
  if (paperStockName) details.push(`Paper stock: ${paperStockName}`);
  if (deliveryDate) details.push(`Target delivery: ${formatDateForEmail(deliveryDate)}`);
  if (addressSummary) details.push(`Shipping to: ${addressSummary}`);

  const summary = details.join("\n");
  const orderLinkLine = orderUrl ? `\nView order: ${orderUrl}\n` : "\n";

  const textBody = `${greeting}

thank you for submitting your ${PRODUCT_NAME} order. Here is a quick summary:

${summary}
${orderLinkLine}We will let you know once production starts. Need help? ${SUPPORT_URL}

Best,
${PRODUCT_NAME} Team`;

  const htmlBody = `<p>${greeting}</p>
<p>thank you for submitting your ${PRODUCT_NAME} order. Here is a quick summary:</p>
<pre style="font-family:monospace;line-height:1.4;">${escapeHtml(summary)}</pre>
${orderUrl ? `<p><a href="${orderUrl}" target="_blank" rel="noopener noreferrer">View this order</a></p>` : ""}
<p>We will let you know once production starts. Need help? <a href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">${SUPPORT_URL}</a></p>
<p>Best,<br/>${PRODUCT_NAME} Team</p>`;

  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: fromEmail,
      To: to,
      Subject: `${PRODUCT_NAME}: Order ${referenceCode} received`,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: messageStream,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[email] Failed to send order confirmation email", response.status, body);
  }
}

function formatDateForEmail(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.valueOf())) return String(value);
  return date.toLocaleDateString("de-AT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
