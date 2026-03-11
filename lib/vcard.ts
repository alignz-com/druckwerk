import { normalizeWebUrl } from "@/lib/normalize-url";
import { normalizeAddress } from "@/lib/normalizeAddress";

type VcardAddress = {
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  addressExtra?: string;
};

type VcardPhoto = {
  data: string;
  type?: string;
};

function vEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function splitName(full: string) {
  const normalized = (full || "").trim().replace(/\s+/g, " ");
  if (!normalized) return { given: "", family: "" };
  const parts = normalized.split(" ");
  if (parts.length === 1) return { given: parts[0], family: "" };
  const family = parts.pop() as string;
  const given = parts.join(" ");
  return { given, family };
}

function foldLine(line: string) {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    chunks.push(line.slice(cursor, cursor + maxLength));
    cursor += maxLength;
  }
  return chunks.join("\r\n ");
}

export function buildVCard3(opts: {
  fullName: string;
  org?: string;
  title?: string;
  seniority?: string;
  photoUrl?: string;
  photo?: VcardPhoto;
  email?: string;
  phone?: string;
  mobile?: string;
  url?: string;
  linkedin?: string;
  addrLabel?: string;
  address?: VcardAddress;
}) {
  const {
    fullName,
    org,
    title,
    seniority,
    photoUrl,
    photo,
    email,
    phone,
    mobile,
    url,
    linkedin,
    addrLabel,
    address,
  } = opts;
  const normalizedUrl = normalizeWebUrl(url);
  const normalizedLinkedin = normalizeWebUrl(linkedin);
  const parsedAddress = addrLabel ? normalizeAddress(addrLabel) : null;
  const resolvedAddress: VcardAddress | undefined = address || parsedAddress
    ? {
        street: address?.street ?? parsedAddress?.street,
        postalCode: address?.postalCode ?? parsedAddress?.postalCode,
        city: address?.city ?? parsedAddress?.city,
        country: address?.country ?? parsedAddress?.country,
        addressExtra: address?.addressExtra,
      }
    : undefined;
  const { given, family } = splitName(fullName);
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEscape(family)};${vEscape(given)};;;`,
    `FN:${vEscape(fullName)}`,
  ];

  if (org) lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (seniority) lines.push(`ROLE:${vEscape(seniority)}`);
  if (photo?.data) {
    const type = photo.type?.toUpperCase() || "JPEG";
    lines.push(foldLine(`PHOTO;ENCODING=b;TYPE=${type}:${photo.data}`));
  } else if (photoUrl) {
    lines.push(`PHOTO;VALUE=URI:${vEscape(photoUrl)}`);
  }
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(phone)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,MOBILE:${vEscape(mobile)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (normalizedUrl) lines.push(`URL;TYPE=Work:${vEscape(normalizedUrl)}`);
  if (normalizedLinkedin) lines.push(`URL;TYPE=LinkedIn:${vEscape(normalizedLinkedin)}`);

  const structuredLabelLines: string[] = [];
  if (resolvedAddress?.street) structuredLabelLines.push(resolvedAddress.street);
  const postalCity = [resolvedAddress?.postalCode, resolvedAddress?.city].filter(Boolean).join(" ").trim();
  if (postalCity) structuredLabelLines.push(postalCity);
  if (resolvedAddress?.country) structuredLabelLines.push(resolvedAddress.country);
  const label = addrLabel || structuredLabelLines.join(", ");
  if (label) {
    lines.push(`LABEL;TYPE=WORK:${vEscape(label)}`);
  }

  if (
    resolvedAddress?.street ||
    resolvedAddress?.postalCode ||
    resolvedAddress?.city ||
    resolvedAddress?.country ||
    resolvedAddress?.addressExtra
  ) {
    const addressLine = [
      "",
      resolvedAddress?.addressExtra ?? "",
      resolvedAddress?.street ?? "",
      resolvedAddress?.city ?? "",
      "",
      resolvedAddress?.postalCode ?? "",
      resolvedAddress?.country ?? "",
    ];
    lines.push(`ADR;TYPE=WORK:${addressLine.map((part) => vEscape(part)).join(";")}`);
  }

  lines.push("END:VCARD");
  return lines.join("\n");
}
