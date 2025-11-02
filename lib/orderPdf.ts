import { PDFDocument, grayscale, type PDFFont, type Color } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { formatPhones } from "@/lib/formatPhones";

const mm2pt = (mm: number) => (mm * 72) / 25.4;

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

export type OrderPdfInput = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  template?: string;
};

export async function generateOrderPdf(input: OrderPdfInput) {
  const {
    name,
    role = "",
    email = "",
    phone = "",
    mobile = "",
    company = "",
    url = "",
    template = "omicron",
  } = input;

  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    throw new Error(`Template not found: ${template}.pdf`);
  }

  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);
  tplDoc.registerFontkit(fontkit);

  const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

  if (tplDoc.getPageCount() < 2) {
    throw new Error("Template must have 2 pages (front/back)");
  }

  const front = tplDoc.getPage(0);
  const back = tplDoc.getPage(1);
  const { height: fh } = front.getSize();

  const L = 24.4;
  const W = 85;
  const TOP = 24;
  const xLeft = mm2pt(L);
  const colWidth = mm2pt(W);
  let y = fh - mm2pt(TOP);

  const nameSize = 10;
  const roleSize = 8;
  const bodySize = 8;
  const lineGap = 4;
  const lineGapBody = 3.5;

  y = drawBlock(front, [name], {
    xLeftPt: xLeft,
    widthPt: colWidth,
    size: nameSize,
    lhMm: lineGap,
    font: Frutiger.Bold,
    align: "left",
  });

  if (role) {
    y = drawBlock(front, [role], {
      xLeftPt: xLeft,
      widthPt: colWidth,
      size: roleSize,
      lhMm: lineGap,
      font: Frutiger.LightItalic ?? Frutiger.Light,
      align: "left",
    });
  }

  y -= mm2pt(3.25);

  const contactLines: string[] = [];
  const phoneLine = formatPhones(phone, mobile);
  if (phoneLine) contactLines.push(phoneLine);
  if (email) contactLines.push(email);
  if (url) contactLines.push(url);

  for (const line of contactLines) {
    const lines = Frutiger.Light ? wrapText(line, colWidth, Frutiger.Light, bodySize) : [line];
    y = drawBlock(front, lines, {
      xLeftPt: xLeft,
      widthPt: colWidth,
      size: bodySize,
      lhMm: lineGapBody,
      font: Frutiger.Light,
      align: "left",
    });
  }

  y -= mm2pt(1.9);

  if (company) {
    const raw = splitLinesMultiline(company).filter(Boolean);
    const wrapped: string[] = [];
    for (const line of raw) {
      if (Frutiger.Light) wrapped.push(...wrapText(line, colWidth, Frutiger.Light, bodySize));
      else wrapped.push(line);
    }
    y = drawBlock(front, wrapped, {
      xLeftPt: xLeft,
      widthPt: colWidth,
      size: bodySize,
      lhMm: lineGapBody,
      font: Frutiger.Light,
      align: "left",
    });
  }

  const orgName = (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";

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

  const qrSize = mm2pt(32);
  const qx = mm2pt(52.8);
  const qy = mm2pt(18.85);
  back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

  const pdfBytes = await tplDoc.save();
  return { pdfBytes, fontReport: report };
}
