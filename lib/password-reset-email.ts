import { getTranslations, isLocale, type Locale } from "@/lib/i18n/messages";
import {
  escapeHtml,
  renderCtaButtonRow,
  renderEmailShell,
  renderGreetingIntroRow,
  type EmailCompanyInfo,
} from "@/lib/email-shell";

export type PasswordResetInput = {
  locale: string | null;
  userName: string | null;
  resetUrl: string;
  operatingSystem: string | null;
  browserName: string | null;
  productName: string;
  company: EmailCompanyInfo;
};

export type PasswordResetResult = {
  subject: string;
  html: string;
  text: string;
};

export function buildPasswordResetEmail(input: PasswordResetInput): PasswordResetResult {
  const locale: Locale = isLocale(input.locale) ? input.locale : "de";
  const t = getTranslations(locale).email.passwordReset;

  const greeting = input.userName?.trim()
    ? t.greeting.replace("{name}", input.userName.trim())
    : t.greetingFallback;

  const intro = t.intro.replace("{productName}", input.productName);
  const subject = `${input.company.name}: ${t.subject}`;
  const preheader = t.preheader.replace("{productName}", input.productName);

  const deviceInfo =
    input.browserName && input.operatingSystem
      ? t.deviceInfo
          .replace("{browser}", input.browserName)
          .replace("{os}", input.operatingSystem)
      : t.deviceInfoUnknown;

  const disclaimerHtml = `
      <tr><td style="padding:4px 32px 8px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
          <p style="margin:0 0 6px;font-size:13px;color:#374151;line-height:1.5;">${escapeHtml(t.expiryNotice)}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.5;">${escapeHtml(deviceInfo)}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${escapeHtml(t.disclaimer)}</p>
        </div>
      </td></tr>`;

  const contentHtml = [
    renderGreetingIntroRow(greeting, intro),
    renderCtaButtonRow(t.cta, input.resetUrl),
    disclaimerHtml,
  ].join("");

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
    intro,
    "",
    `${t.cta}: ${input.resetUrl}`,
    "",
    t.expiryNotice,
    deviceInfo,
    t.disclaimer,
    "",
    t.contactLine,
    "",
    `${t.signoff},`,
    input.company.name,
  ];

  return { subject, html, text: textLines.join("\n") };
}
