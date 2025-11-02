import { PDFDocument, grayscale, type PDFFont, type Color } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { formatPhones } from "@/lib/formatPhones";
import type { TemplateTextStyle } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";

const mm2pt = (mm: number) => (mm * 72) / 25.4;

export type OrderPdfFields = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
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
  addrLabel?: string;
}) {
  const { fullName, org, title, email, phone, mobile, url, addrLabel } = opts;
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
  if (url) lines.push(`URL:${vEscape(url)}`);

  if (addrLabel) {
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

export async function generateOrderPdf(fields: OrderPdfFields, template: ResolvedTemplate) {
  const { name, role = "", email = "", phone = "", mobile = "", company = "", url = "" } = fields;

  const tplBytes = await loadTemplatePdfBytes(template.pdfPath);
  const tplDoc = await PDFDocument.load(tplBytes);
  tplDoc.registerFontkit(fontkit);

  const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

  if (tplDoc.getPageCount() < 2) {
    throw new Error("Template must have 2 pages (front/back)");
  }

  const front = tplDoc.getPage(0);
  const back = tplDoc.getPage(1);
  const { height: pageHeight } = front.getSize();

  const frame = template.config.front.textFrame;
  const xLeft = mm2pt(frame.xMm);
  const colWidth = mm2pt(frame.columnWidthMm);
  let cursor = pageHeight - mm2pt(frame.topMm);

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

  const orgName = (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";

  if (template.config.back.mode === "qr" && template.config.back.qr) {
    const vcard = buildVCard3({
      fullName: name,
      org: orgName,
      title: role || undefined,
      email: email || undefined,
      phone: phone || undefined,
      mobile: mobile || undefined,
      url: url || undefined,
      addrLabel,
    });

    const dataUrl = await QRCode.toDataURL(vcard, {
      width: 1024,
      margin: 0,
      errorCorrectionLevel: "M",
    });
    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await tplDoc.embedPng(pngBytes);

    const qrConfig = template.config.back.qr;
    const qrSize = mm2pt(qrConfig.sizeMm);
    const qx = mm2pt(qrConfig.xMm);
    const qy = mm2pt(qrConfig.yMm);
    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });
  }

  const pdfBytes = await tplDoc.save();
  return { pdfBytes, fontReport: report };
}
