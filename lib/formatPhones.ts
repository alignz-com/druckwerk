// lib/formatPhones.ts
export type PhoneLabels = { landline?: string; mobile?: string };
export type PhoneFormatOpts = { sep?: string; labels?: PhoneLabels };

export function formatPhones(
  phone?: string,
  mobile?: string,
  opts: PhoneFormatOpts = {}
): string | undefined {
  const sep = opts.sep ?? " | ";
  const labels: Required<PhoneLabels> = {
    landline: opts.labels?.landline ?? "T",
    mobile:   opts.labels?.mobile   ?? "M",
  };

  const p = (phone ?? "").trim();
  const m = (mobile ?? "").trim();
  if (!p && !m) return undefined;

  const parts: string[] = [];
  if (p) parts.push(`${labels.landline} ${p}`);
  if (m) parts.push(`${labels.mobile} ${m}`);
  const line = parts.join(sep);
  return line || undefined;
}
