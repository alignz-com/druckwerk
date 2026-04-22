import type { Locale } from "@/lib/i18n/messages";

export type EmailCompanyInfo = {
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  logoUrl: string | null;
};

export type EmailShellInput = {
  locale: Locale;
  subject: string;
  preheader: string;
  contentHtml: string;
  contactLine: string;
  signoff: string;
  company: EmailCompanyInfo;
};

export function renderEmailShell(input: EmailShellInput): string {
  const headerHtml = input.company.logoUrl
    ? `<img src="${escapeAttr(input.company.logoUrl)}" alt="${escapeAttr(input.company.name)}" style="max-height:52px;width:auto;display:block;border:0;">`
    : `<div style="font-size:22px;font-weight:600;color:#111827;">${escapeHtml(input.company.name)}</div>`;

  const addressLine = [input.company.postalCode, input.company.city].filter(Boolean).join(" ");
  const footerLines = [input.company.name, input.company.street, addressLine || null].filter(Boolean) as string[];
  const footerHtml = footerLines
    .map((line, i) =>
      i === 0 ? `<strong style="color:#374151;">${escapeHtml(line)}</strong>` : escapeHtml(line),
    )
    .join("<br>");

  return `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.subject)}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;color-scheme:light;">
<div style="display:none;max-height:0;overflow:hidden;visibility:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;border:1px solid #e5e7eb;">
      <tr><td style="padding:36px 32px 28px;">${headerHtml}</td></tr>
      ${input.contentHtml}
      <tr><td style="padding:28px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${escapeHtml(input.contactLine)}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          ${escapeHtml(input.signoff)},<br>
          ${footerHtml}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderCtaButtonRow(label: string, url: string): string {
  return `
      <tr><td style="padding:28px 32px 36px;" align="center">
        <a href="${escapeAttr(url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>
      </td></tr>`;
}

export function renderGreetingIntroRow(greeting: string, intro: string): string {
  return `
      <tr><td style="padding:0 32px;">
        <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#111827;">${escapeHtml(greeting)}</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563;">${escapeHtml(intro)}</p>
      </td></tr>`;
}

export function escapeHtml(input: string): string {
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

export function escapeAttr(input: string): string {
  return escapeHtml(input);
}
