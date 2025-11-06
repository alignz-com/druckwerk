import { PDFDocument, grayscale, rgb, type PDFFont, type Color } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { formatPhones } from "@/lib/formatPhones";
import { normalizeAddress } from "@/lib/normalizeAddress";
import { getCountryLabel } from "@/lib/countries";
import type { TemplateTextStyle } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";
import type {
  DesignElement,
  RectElement,
  StackElement,
  TemplateDesign,
  TextElement,
} from "@/lib/template-design";

const mm2pt = (mm: number) => (mm * 72) / 25.4;
const pt2mm = (pt: number) => (pt * 25.4) / 72;

type PdfFontPack = {
  regular?: PDFFont;
  bold?: PDFFont;
  italic?: PDFFont;
  boldItalic?: PDFFont;
};

function parseColor(value: string | undefined) {
  if (!value) return undefined;
  let hex = value.trim();
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6) return undefined;
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
  return rgb(r, g, b);
}

function resolveField(context: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let current: any = context;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function evaluateVisibility(elementVisibility: TextElement["visibility"], context: Record<string, unknown>) {
  if (!elementVisibility) return true;
  const value = resolveField(context, elementVisibility.binding);
  if (elementVisibility.equals !== undefined) {
    return value === elementVisibility.equals;
  }
  if (elementVisibility.notEmpty) {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }
  return Boolean(value);
}

function evaluateTextParts(element: TextElement, context: Record<string, unknown>) {
  const parts = element.parts ?? (element.binding ? [{ type: "binding" as const, field: element.binding }] : []);
  if (parts.length === 0) return "";

  const bindingStates = new Map<string, { text: string; hasValue: boolean }>();
  const evaluated = parts.map((part) => {
    if (part.type === "literal") {
      return { kind: "literal" as const, text: part.value, requires: part.requires ?? [] };
    }
    const raw = resolveField(context, part.field);
    let value: string | null = null;
    if (raw == null || (typeof raw === "string" && raw.trim().length === 0)) {
      value = part.fallback ?? null;
    } else if (Array.isArray(raw)) {
      value = raw.filter(Boolean).join(", ");
    } else {
      value = String(raw);
    }
    const hasValue = Boolean(value && value.trim().length > 0);
    const text = hasValue ? `${part.prefix ?? ""}${value}${part.suffix ?? ""}` : "";
    bindingStates.set(part.field, { text, hasValue });
    return { kind: "binding" as const, field: part.field, text, hasValue };
  });

  const output: string[] = [];
  for (const item of evaluated) {
    if (item.kind === "binding") {
      if (item.hasValue) output.push(item.text);
    } else {
      const ok = item.requires.length === 0 || item.requires.every((field) => bindingStates.get(field)?.hasValue);
      if (ok) output.push(item.text);
    }
  }
  const result = output.join("");
  return result.trim().length > 0 ? result : "";
}

export type OrderPdfFields = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  linkedin?: string;
  address?: {
    companyName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    countryCode?: string;
    addressExtra?: string;
  };
};

function vEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function splitName(full: string) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { given: "", family: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { given: parts[0], family: "" };
  const family = parts.pop() as string;
  const given = parts.join(" ");
  return { given, family };
}

function buildVCard3(opts: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  url?: string;
  linkedin?: string;
  addrLabel?: string;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    addressExtra?: string;
  };
}) {
  const { fullName, org, title, email, phone, mobile, url, linkedin, addrLabel, address } = opts;
  const { given, family } = splitName(fullName);
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEscape(family)};${vEscape(given)};;;`,
    `FN:${vEscape(fullName)}`,
  ];

  if (org) lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(phone)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,MOBILE:${vEscape(mobile)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url) lines.push(`URL;TYPE=Work:${vEscape(url)}`);
  if (linkedin) lines.push(`URL;TYPE=LinkedIn:${vEscape(linkedin)}`);

  const structuredLabelLines: string[] = [];
  if (address?.street) structuredLabelLines.push(address.street);
  const postalCity = [address?.postalCode, address?.city].filter(Boolean).join(" " ).trim();
  if (postalCity) structuredLabelLines.push(postalCity);
  if (address?.country) structuredLabelLines.push(address.country);
  if (address?.addressExtra) structuredLabelLines.push(address.addressExtra);
  const resolvedLabel = structuredLabelLines.length > 0 ? structuredLabelLines.join("\n") : addrLabel ?? "";
  if (structuredLabelLines.length > 0 || addrLabel) {
    const streetLine = vEscape(address?.street ?? "");
    const cityLine = vEscape(address?.city ?? "");
    const postalLine = vEscape(address?.postalCode ?? "");
    const countryLine = vEscape(address?.country ?? "");
    const extraLine = vEscape(address?.addressExtra ?? "");
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(resolvedLabel)}":;${extraLine};${streetLine};${cityLine};;${postalLine};${countryLine}`);
  } else if (addrLabel) {
    const adr = ["", "", vEscape(addrLabel), "", "", "", ""].join(";");
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":${adr}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

const splitLinesMultiline = (s: string) =>
  s.replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

type Align = "left" | "center" | "right";

function wrapText(text: string, maxWidthPt: number, font: PDFFont, sizePt: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? `${buf} ${w}` : w;
    if (font.widthOfTextAtSize(next, sizePt) <= maxWidthPt) {
      buf = next;
    } else {
      if (buf) lines.push(buf);
      if (font.widthOfTextAtSize(w, sizePt) > maxWidthPt) {
        let cut = "";
        for (const ch of w) {
          const t = cut + ch;
          if (font.widthOfTextAtSize(t, sizePt) > maxWidthPt) {
            lines.push(cut);
            cut = ch;
          } else {
            cut = t;
          }
        }
        buf = cut;
      } else {
        buf = w;
      }
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

type PdfClampResult = {
  text: string;
  truncated: boolean;
};

function clampTextToWidthPdf(
  text: string,
  maxWidthPt: number,
  font: PDFFont,
  fontSizePt: number,
  letterSpacingPt: number,
): PdfClampResult {
  const widthWithSpacing = (value: string) =>
    font.widthOfTextAtSize(value, fontSizePt) + Math.max(0, value.length - 1) * letterSpacingPt;

  if (widthWithSpacing(text) <= maxWidthPt) {
    return { text, truncated: false };
  }

  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const test = text.slice(0, mid) + ellipsis;
    if (widthWithSpacing(test) <= maxWidthPt) {
      best = test;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const clamped = best || "";
  return { text: clamped, truncated: Boolean(clamped && clamped !== text) };
}

function drawLine(
  page: any,
  text: string,
  yPt: number,
  opts: {
    xLeftPt: number;
    widthPt: number;
    size: number;
    font?: PDFFont;
    align?: Align;
    color?: Color;
  },
) {
  const { xLeftPt, widthPt, size, font, align = "left", color = grayscale(0) } = opts;
  const w = font ? font.widthOfTextAtSize(text, size) : 0;
  let x = xLeftPt;
  if (align === "center") x = xLeftPt + (widthPt - w) / 2;
  if (align === "right") x = xLeftPt + widthPt - w;
  page.drawText(text, { x, y: yPt, size, font, color });
}

function drawBlock(
  page: any,
  lines: string[],
  startY: number,
  opts: { xLeftPt: number; widthPt: number; size: number; lhMm: number; font?: PDFFont; align?: Align },
) {
  const { xLeftPt, widthPt, size, lhMm, font, align } = opts;
  let y = startY;
  for (const line of lines) {
    drawLine(page, line, y, { xLeftPt, widthPt, size, font, align });
    y -= mm2pt(lhMm);
  }
  return y;
}

async function loadFrutiger(doc: PDFDocument) {
  const base = path.join(process.cwd(), "public", "fonts");
  const candidates = (name: string) => [
    path.join(base, `${name}.ttf`),
    path.join(base, `${name}.otf`),
  ];
  const files = {
    Light: candidates("FrutigerLTPro-Light"),
    LightItalic: candidates("FrutigerLTPro-LightItalic"),
    Bold: candidates("FrutigerLTPro-Bold"),
  } as const;

  const fonts: Partial<Record<keyof typeof files, PDFFont>> = {};
  const report: string[] = [];

  for (const [key, list] of Object.entries(files) as Array<[keyof typeof files, string[]]>) {
    const picked = list.find((p) => existsSync(p));
    if (!picked) {
      report.push(`MISSING ${String(key)}: ${list.join(" | ")}`);
      continue;
    }
    try {
      const bytes = await readFile(picked);
      const font = await doc.embedFont(bytes, { subset: true });
      void font.widthOfTextAtSize("ÄÖÜ äöü ß", 10);
      fonts[key] = font;
      report.push(`EMBEDDED ${String(key)} (${path.basename(picked)}): ${Math.round(bytes.byteLength / 1024)} kB`);
    } catch (error: any) {
      report.push(`EMBED ERROR ${String(key)}: ${error?.message || String(error)}`);
    }
  }

  return { fonts, report };
}

async function loadTemplatePdfBytes(pdfPath: string) {
  if (/^https?:/i.test(pdfPath)) {
    const res = await fetch(pdfPath);
    if (!res.ok) {
      throw new Error(`Failed to fetch template PDF (${res.status}): ${pdfPath}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const relative = pdfPath.startsWith("/") ? pdfPath.slice(1) : pdfPath;
  const localPath = path.join(process.cwd(), "public", relative);
  if (!existsSync(localPath)) {
    throw new Error(`Template not found at ${localPath}`);
  }
  return readFile(localPath);
}

function pickFont(style: TemplateTextStyle, fonts: Partial<Record<string, PDFFont>>) {
  switch (style.font) {
    case "bold":
      return fonts.Bold ?? fonts.Light ?? fonts.LightItalic;
    case "lightItalic":
      return fonts.LightItalic ?? fonts.Light ?? fonts.Bold;
    case "light":
    default:
      return fonts.Light ?? fonts.LightItalic ?? fonts.Bold;
  }
}

function pickDesignFont(font: TextElement["font"], fonts: PdfFontPack) {
  const weight = font.weight ?? 400;
  const style = font.style?.toLowerCase?.() ?? "normal";
  const italic = style === "italic";

  if (italic && weight >= 600) return fonts.boldItalic ?? fonts.italic ?? fonts.bold ?? fonts.regular;
  if (italic) return fonts.italic ?? fonts.regular ?? fonts.bold;
  if (weight >= 600) return fonts.bold ?? fonts.regular ?? fonts.italic;
  return fonts.regular ?? fonts.bold ?? fonts.italic;
}

function renderDesignElementsToPdf(opts: {
  page: any;
  elements: DesignElement[];
  context: Record<string, unknown>;
  fonts: PdfFontPack;
  cardWidthMm: number;
  cardHeightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  offsetXMm: number;
  offsetYMm: number;
}) {
  const { page, elements, context, fonts, cardWidthMm, cardHeightMm, pageWidthMm, pageHeightMm, offsetXMm, offsetYMm } = opts;
  const mmToPt = mm2pt;

  const renderElement = (element: DesignElement, offsetX = 0, offsetY = 0): number => {
    switch (element.type) {
      case "rect": {
        if (element.visibility && !evaluateVisibility(element.visibility, context)) return 0;
        const xMm = offsetXMm + offsetX + element.xMm;
        const yMm = offsetYMm + offsetY + element.yMm;
        const widthMm = element.widthMm;
        const heightMm = element.heightMm;
        const x = mmToPt(xMm);
        const y = mmToPt(pageHeightMm - yMm - heightMm);
        page.drawRectangle({
          x,
          y,
          width: mmToPt(widthMm),
          height: mmToPt(heightMm),
          color: element.fill ? parseColor(element.fill) : undefined,
          opacity: element.opacity,
          borderColor: element.stroke ? parseColor(element.stroke) : undefined,
          borderWidth: element.strokeWidthMm ? mmToPt(element.strokeWidthMm) : undefined,
        });
        return heightMm;
      }
      case "text": {
        if (!evaluateVisibility(element.visibility, context)) return 0;
        const content = evaluateTextParts(element, context);
        if (!content) return 0;
        const font = pickDesignFont(element.font, fonts);
        if (!font) return 0;
        const sizePt = element.font.sizePt;
        const letterSpacingPt = element.font.letterSpacing ? mmToPt(element.font.letterSpacing) : 0;
        const textAnchor = element.textAnchor ?? "start";
        let text = content;
        let truncated = false;
        if (element.maxWidthMm) {
          const maxWidthPt = mmToPt(element.maxWidthMm);
          const clamped = clampTextToWidthPdf(text, maxWidthPt, font, sizePt, letterSpacingPt);
          text = clamped.text;
          if (!text) return 0;
          truncated = clamped.truncated;
        }
        const xMm = offsetXMm + offsetX + (element.xMm ?? 0);
        const yMm = offsetYMm + offsetY + (element.yMm ?? 0);
        const baselineMode = element.font.baseline ?? "hanging";
        const pageHeightPt = mmToPt(pageHeightMm);

        const textWidthPt =
          font.widthOfTextAtSize(text, sizePt) + Math.max(0, text.length - 1) * letterSpacingPt;
        let x = mmToPt(xMm);
        if (textAnchor === "middle") {
          x -= textWidthPt / 2;
        } else if (textAnchor === "end") {
          x -= textWidthPt;
        }

        const topPt = mmToPt(yMm);
        let baselinePt: number;
        if (baselineMode === "hanging") {
          const ascentPt = font.heightAtSize(sizePt, { descender: false });
          baselinePt = topPt + ascentPt;
        } else {
          baselinePt = topPt;
        }
        const y = pageHeightPt - baselinePt;

        const fillColor = truncated ? rgb(1, 0, 0) : parseColor(element.font.color);
        page.drawText(text, {
          x,
          y,
          size: sizePt,
          font,
          color: fillColor,
          characterSpacing: letterSpacingPt,
        });
        const lineHeightMm =
          element.font.lineHeightMm ??
          (element.font.lineHeight ?? 1.2) * pt2mm(sizePt);
        return lineHeightMm;
      }
      case "stack": {
        if (!evaluateVisibility(element.visibility, context)) return 0;
        const gapMm = element.gapMm ?? 0;
        let cursor = 0;
        for (const child of element.items) {
          const childHeight = renderElement(child, offsetX + element.xMm, offsetY + element.yMm + cursor);
          if (childHeight > 0) {
            cursor += childHeight + gapMm;
          }
        }
        return cursor;
      }
      default:
        return 0;
    }
  };

  elements.forEach((element) => renderElement(element));
}

export async function generateOrderPdf(fields: OrderPdfFields, template: ResolvedTemplate) {
  const {
    name,
    role = "",
    email = "",
    phone = "",
    mobile = "",
    company = "",
    url = "",
    linkedin = "",
    address,
  } = fields;

  const companyFirstLine = (company || "").split(/\r?\n/)[0]?.trim() || "";

  const fallbackCompanyName = companyFirstLine || undefined;

  const resolvedAddress = (() => {
    if (address) {
      const countryName = address.country ?? (address.countryCode ? getCountryLabel("en", address.countryCode) : undefined);
      const companyName = address.companyName ?? fallbackCompanyName;
      return {
        companyName,
        street: address.street ?? undefined,
        postalCode: address.postalCode ?? undefined,
        city: address.city ?? undefined,
        country: countryName ?? undefined,
        addressExtra: address.addressExtra ?? undefined,
      };
    }
    const parsed = normalizeAddress(company);
    const companyName = parsed.org ?? fallbackCompanyName;
    return {
      companyName,
      street: parsed.street ?? undefined,
      postalCode: parsed.postalCode ?? undefined,
      city: parsed.city ?? undefined,
      country: parsed.country ?? undefined,
      addressExtra: undefined,
    };
  })();

  const companyPrimary = resolvedAddress.companyName ?? companyFirstLine;

  const tplBytes = await loadTemplatePdfBytes(template.pdfPath);
  const tplDoc = await PDFDocument.load(tplBytes);
  tplDoc.registerFontkit(fontkit);

  const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

  if (tplDoc.getPageCount() < 2) {
    throw new Error("Template must have 2 pages (front/back)");
  }

  const front = tplDoc.getPage(0);
  const back = tplDoc.getPage(1);
  const { width: pageWidth, height: pageHeight } = front.getSize();
  const pageWidthMm = pt2mm(pageWidth);
  const pageHeightMm = pt2mm(pageHeight);
  const cardWidthMm = 85;
  const cardHeightMm = 55;
  const offsetXMm = Math.max(0, (pageWidthMm - cardWidthMm) / 2);
  const offsetYMm = Math.max(0, (pageHeightMm - cardHeightMm) / 2);

  const pdfFonts: PdfFontPack = {
    regular: Frutiger.Light,
    bold: Frutiger.Bold,
    italic: Frutiger.LightItalic,
    boldItalic: Frutiger.Bold ?? Frutiger.LightItalic,
  };

  const frame = template.config.front.textFrame;

  const sharedContext = {
    name,
    role,
    email,
    phone,
    mobile,
    company,
    companyPrimary,
    companySecondary: (() => {
      const parts: string[] = [];
      if (resolvedAddress.street) parts.push(resolvedAddress.street);
      const postalCity = [resolvedAddress.postalCode, resolvedAddress.city].filter(Boolean).join(" ").trim();
      if (postalCity) parts.push(postalCity);
      if (resolvedAddress.country) parts.push(resolvedAddress.country);
      const candidate = parts.filter(Boolean).join(" | ");
      if (candidate) return candidate;
      const restLines = (company || "")
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean);
      return restLines[0] ?? "";
    })(),
    url,
    linkedin,
    address: resolvedAddress,
  };

  const hasDesignFront = Array.isArray(template.design?.front) && template.design!.front.length > 0;
  if (hasDesignFront) {
    renderDesignElementsToPdf({
      page: front,
      elements: template.design!.front,
      context: sharedContext,
      fonts: pdfFonts,
      cardWidthMm,
      cardHeightMm,
      pageWidthMm,
      pageHeightMm,
      offsetXMm,
      offsetYMm,
    });
  } else {
    const frame = template.config.front.textFrame;
    const xLeft = mm2pt(frame.xMm + offsetXMm);
    const colWidth = mm2pt(frame.columnWidthMm);
    let cursor = pageHeight - mm2pt(offsetYMm + frame.topMm);

    const applyBlock = (lines: string[], style?: TemplateTextStyle) => {
      if (!style || lines.length === 0) return;
      const fontRef = pickFont(style, Frutiger);
      cursor = drawBlock(front, lines, cursor, {
        xLeftPt: xLeft,
        widthPt: colWidth,
        size: style.sizePt,
        lhMm: style.lineGapMm,
        font: fontRef,
        align: "left",
      });
      if (style.spacingAfterMm) {
        cursor -= mm2pt(style.spacingAfterMm);
      }
    };

    applyBlock([name], frame.name);
    if (role) applyBlock([role], frame.role);

    const contactLines: string[] = [];
    const phoneLine = formatPhones(phone, mobile);
    if (phoneLine) contactLines.push(phoneLine);
    if (email) contactLines.push(email);
    if (url) contactLines.push(url);
    if (linkedin) contactLines.push(linkedin);

    if (frame.contacts) {
      const contactsFont = pickFont(frame.contacts, Frutiger) ?? Frutiger.Light ?? Frutiger.Bold;
      const contactWrapped = contactsFont
        ? contactLines.flatMap((line) => wrapText(line, colWidth, contactsFont, frame.contacts!.sizePt))
        : contactLines;
      applyBlock(contactWrapped, frame.contacts);
    }

    if (frame.company) {
      const raw = splitLinesMultiline(company || "");
      const companyFont = pickFont(frame.company, Frutiger) ?? Frutiger.Light ?? Frutiger.Bold;
      const wrapped = companyFont
        ? raw.flatMap((line) => wrapText(line, colWidth, companyFont, frame.company!.sizePt))
        : raw;
      applyBlock(wrapped, frame.company);
    }
  }

  const orgName = address?.companyName || (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";

  let qrData: string | null = null;
  if (template.config.back.mode === "qr" && template.config.back.qr) {
    const vcard = buildVCard3({
      fullName: name,
      org: orgName,
      title: role || undefined,
      email: email || undefined,
      phone: phone || undefined,
      mobile: mobile || undefined,
      url: url || undefined,
      linkedin: linkedin || undefined,
      addrLabel,
      address: resolvedAddress,
    });
    qrData = await QRCode.toDataURL(vcard, {
      width: 1024,
      margin: 0,
      errorCorrectionLevel: "M",
    });
  }

  const hasDesignBack = Array.isArray(template.design?.back) && template.design!.back.length > 0;
  if (hasDesignBack) {
    renderDesignElementsToPdf({
      page: back,
      elements: template.design!.back,
      context: { ...sharedContext, qrData },
      fonts: pdfFonts,
      cardWidthMm,
      cardHeightMm,
      pageWidthMm,
      pageHeightMm,
      offsetXMm,
      offsetYMm,
    });
  }

  if (template.config.back.mode === "qr" && template.config.back.qr && qrData) {
    const pngBytes = Buffer.from(qrData.split(",")[1], "base64");
    const img = await tplDoc.embedPng(pngBytes);

    const qrConfig = template.config.back.qr;
    const qrSize = mm2pt(qrConfig.sizeMm);
    const qx = mm2pt(offsetXMm + qrConfig.xMm);
    const qy = mm2pt(offsetYMm + qrConfig.yMm);
    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

    const captionFont = pickFont(frame.contacts ?? frame.company ?? frame.name, Frutiger) ?? Frutiger.Light;
    if (captionFont) {
      back.drawText("Scan to save contact", {
        x: qx,
        y: qy - mm2pt(4),
        size: 8,
        font: captionFont,
      });
    }
  }

  const pdfBytes = await tplDoc.save();
  return { pdfBytes, fontReport: report };
}
