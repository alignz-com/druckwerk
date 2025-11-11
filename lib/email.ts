const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const POSTMARK_TEMPLATE_API_URL = "https://api.postmarkapp.com/email/withTemplate";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const PRODUCT_NAME = process.env.APP_PRODUCT_NAME || process.env.NEXT_PUBLIC_APP_NAME || "druckwerk";
const SUPPORT_URL = process.env.SUPPORT_URL || APP_URL || "https://druckwerk.dth.at";

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
  const templateId = process.env.POSTMARK_PASSWORD_RESET_TEMPLATE_ID;
  const templateAlias = process.env.POSTMARK_PASSWORD_RESET_TEMPLATE_ALIAS;
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM || "outbound";

  if (!apiToken || !fromEmail) {
    console.warn("[email] Missing Postmark configuration, skipping password reset email");
    return;
  }

  let templateTarget: Record<string, number | string> | null = null;
  if (templateId) {
    const parsedId = Number(templateId);
    if (Number.isNaN(parsedId)) {
      console.error("[email] POSTMARK_PASSWORD_RESET_TEMPLATE_ID must be a number");
    } else {
      templateTarget = { TemplateId: parsedId };
    }
  } else if (templateAlias) {
    templateTarget = { TemplateAlias: templateAlias };
  }

  if (templateTarget) {
    const templateConfig: Record<string, unknown> = {
      From: fromEmail,
      To: to,
      MessageStream: messageStream,
      ...templateTarget,
      TemplateModel: {
        name: name?.trim() || undefined,
        product_name: PRODUCT_NAME,
        action_url: resetUrl,
        operating_system: operatingSystem || "Unknown",
        browser_name: browserName || "Unknown",
        support_url: SUPPORT_URL,
        is_de: locale?.toLowerCase().startsWith("de") ?? false,
      },
    };

    const response = await fetch(POSTMARK_TEMPLATE_API_URL, {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateConfig),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[email] Failed to send password reset email via template", response.status, body);
    }
    return;
  }

  // Fallback to basic email API if no template is configured.
  const subject = "Reset your druckwerk password";
  const greeting = name?.trim() ? `Hello ${name.trim()},` : "Hello,";
  const textBody = `${greeting}\n\nWe received a request to reset your password.\n\nReset password: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  const htmlBody = `<p>${greeting}</p><p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`;

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
