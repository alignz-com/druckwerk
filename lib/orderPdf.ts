import { PDFDocument, grayscale, rgb, PDFOperator, PDFOperatorNames, asPDFNumber, type PDFFont, type Color, type PDFPage } from "pdf-lib";
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
import { formatUrlForDisplay, normalizeWebUrl } from "./normalize-url";
import { buildVCard3 } from "@/lib/vcard";
import type {
  DesignElement,
  QrElement,
  RectElement,
  StackElement,
  TemplateDesign,
  TextElement,
} from "@/lib/template-design";

const mm2pt = (mm: number) => (mm * 72) / 25.4;
const pt2mm = (pt: number) => (pt * 25.4) / 72;

/**
 * Draw text with character spacing (tracking).
 * pdf-lib's drawText doesn't support characterSpacing, so we set the Tc
 * operator directly before drawing and reset it after.
 */
function drawTextWithTracking(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color?: Color; characterSpacing?: number },
) {
  const cs = opts.characterSpacing ?? 0;
  if (cs === 0) {
    page.drawText(text, opts);
    return;
  }
  // Set Tc (character spacing), draw text, reset Tc to 0
  page.pushOperators(PDFOperator.of(PDFOperatorNames.SetCharacterSpacing, [asPDFNumber(cs)]));
  page.drawText(text, { x: opts.x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
  page.pushOperators(PDFOperator.of(PDFOperatorNames.SetCharacterSpacing, [asPDFNumber(0)]));
}

type PdfFontPack = {
  regular?: PDFFont;
  bold?: PDFFont;
  italic?: PDFFont;
  boldItalic?: PDFFont;
};

function designContainsQr(elements: DesignElement[] | undefined): boolean {
  if (!elements) return false;
  for (const element of elements) {
    if (element.type === "qr") return true;
    if (element.type === "stack" && designContainsQr(element.items)) return true;
  }
  return false;
}

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

type QrMatrixPayload = {
  modules: {
    size?: number;
    data?: ArrayLike<number>;
    get?: (row: number, col: number) => boolean;
  };
  dark?: string;
  light?: string;
};

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

function applySegmentStylesToText(
  text: string,
  rules: TextElement["segmentStyles"] | undefined,
): Array<{ text: string; color?: string }> {
  if (!text) return [];
  if (!rules || rules.length === 0) return [{ text }];

  let segments: Array<{ text: string; color?: string }> = [{ text }];
  for (const rule of rules) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(rule.pattern, rule.flags ?? "");
    } catch {
      continue;
    }

    const next: Array<{ text: string; color?: string }> = [];
    for (const segment of segments) {
      if (!segment.text) continue;
      if (segment.color) {
        next.push(segment);
        continue;
      }

      matcher.lastIndex = 0;
      const match = matcher.exec(segment.text);
      if (!match || match[0].length === 0) {
        next.push(segment);
        continue;
      }

      const start = match.index;
      const end = start + match[0].length;
      if (start > 0) {
        next.push({ text: segment.text.slice(0, start) });
      }
      next.push({ text: segment.text.slice(start, end), color: rule.color });
      if (end < segment.text.length) {
        next.push({ text: segment.text.slice(end) });
      }
    }
    segments = next;
  }
  return segments;
}

export type OrderPdfFields = {
  name: string;
  role?: string;
  seniority?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  linkedin?: string;
  qrPayload?: string | null;
  photoUrl?: string;
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

function findQrStyle(
  elements: DesignElement[] | undefined,
): { dark?: string; light?: string } | null {
  if (!elements) return null;
  for (const element of elements) {
    if (element.type === "qr") {
      return {
        dark: element.color,
        light: element.background,
      };
    }
    if (element.type === "stack") {
      const nested = findQrStyle(element.items);
      if (nested) return nested;
    }
  }
  return null;
}

function normalizeQrColor(value?: string | null, fallback?: string): string | undefined {
  if (!value) return fallback;
  const raw = value.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "transparent") return fallback;
  if (!raw.startsWith("#")) return fallback;
  const hex = raw.slice(1);
  if (hex.length === 3) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 4) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 6) return `#${hex}`;
  return fallback;
}

function isHexColor(value?: string) {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

function matchFontFamilyKey(input?: string | null) {
  return (input ?? "").trim().toLowerCase();
}

function pickDesignFontForElement(
  font: TextElement["font"],
  fontsByFamily: Map<string, PdfFontPack>,
  fallback: PdfFontPack,
) {
  const familyKey = matchFontFamilyKey(font.family);
  const pack = familyKey ? fontsByFamily.get(familyKey) : undefined;
  return pickDesignFont(font, pack ?? fallback);
}

function pickBestVariant(
  variants: Array<{ weight: number; style: string; font: PDFFont }>,
  opts: { weight: number; italic: boolean },
) {
  const targetItalic = opts.italic;
  const targetWeight = opts.weight;
  const sameStyle = variants.filter((variant) => (variant.style === "italic") === targetItalic);
  const pool = sameStyle.length > 0 ? sameStyle : variants;
  let best = pool[0];
  let bestDelta = Math.abs(pool[0].weight - targetWeight);
  for (const variant of pool) {
    const delta = Math.abs(variant.weight - targetWeight);
    if (delta < bestDelta) {
      best = variant;
      bestDelta = delta;
    }
  }
  return best?.font;
}

async function loadTemplateFonts(doc: PDFDocument, template: ResolvedTemplate) {
  const fontsByFamily = new Map<string, PdfFontPack>();
  const fontRecords = (template.fonts ?? []).filter((record) => {
    const format = String(record.format || "").toLowerCase();
    return format === "ttf";
  });
  if (fontRecords.length === 0) return fontsByFamily;

  const variantsByFamily = new Map<string, Array<{ weight: number; style: string; font: PDFFont }>>();
  await Promise.all(
    fontRecords.map(async (record) => {
      try {
        if (!record.publicUrl) return;
        const res = await fetch(record.publicUrl);
        if (!res.ok) {
          console.warn(`[pdf] Failed to load font ${record.publicUrl}: ${res.status}`);
          return;
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        const font = await doc.embedFont(bytes, { subset: true });
        void font.widthOfTextAtSize("ÄÖÜ äöü ß", 10);
        const key = matchFontFamilyKey(record.fontFamilyName);
        if (!key) return;
        if (!variantsByFamily.has(key)) variantsByFamily.set(key, []);
        variantsByFamily.get(key)!.push({
          weight: record.weight ?? 400,
          style: record.style?.toLowerCase?.() === "italic" ? "italic" : "normal",
          font,
        });
      } catch (error) {
        console.warn("[pdf] Failed to embed font", error);
      }
    }),
  );

  for (const [familyKey, variants] of variantsByFamily) {
    if (variants.length === 0) continue;
    const regular = pickBestVariant(variants, { weight: 400, italic: false });
    const bold = pickBestVariant(variants, { weight: 700, italic: false });
    const italic = pickBestVariant(variants, { weight: 400, italic: true });
    const boldItalic = pickBestVariant(variants, { weight: 700, italic: true });
    fontsByFamily.set(familyKey, { regular, bold, italic, boldItalic });
  }

  return fontsByFamily;
}

async function renderDesignElementsToPdf(opts: {
  doc: PDFDocument;
  page: any;
  elements: DesignElement[];
  context: Record<string, unknown>;
  fonts: PdfFontPack;
  fontsByFamily: Map<string, PdfFontPack>;
  cardWidthMm: number;
  cardHeightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  offsetXMm: number;
  offsetYMm: number;
}) {
  const {
    doc,
    page,
    elements,
    context,
    fonts,
    fontsByFamily,
    cardWidthMm,
    cardHeightMm,
    pageWidthMm,
    pageHeightMm,
    offsetXMm,
    offsetYMm,
  } = opts;
  const mmToPt = mm2pt;
  const imageCache = new Map<string, any>();

  const renderElement = async (element: DesignElement, offsetX = 0, offsetY = 0): Promise<number> => {
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
        const font = pickDesignFontForElement(element.font, fontsByFamily, fonts);
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
        if (truncated) {
          drawTextWithTracking(page, text, {
            x,
            y,
            size: sizePt,
            font,
            color: fillColor,
            characterSpacing: letterSpacingPt,
          });
        } else {
          const segments = applySegmentStylesToText(text, element.segmentStyles).filter((segment) => segment.text.length > 0);
          if (segments.length <= 1) {
            drawTextWithTracking(page, text, {
              x,
              y,
              size: sizePt,
              font,
              color: fillColor,
              characterSpacing: letterSpacingPt,
            });
          } else {
            let cursorX = x;
            for (let index = 0; index < segments.length; index += 1) {
              const segment = segments[index];
              const segmentColor = parseColor(segment.color) ?? fillColor;
              drawTextWithTracking(page, segment.text, {
                x: cursorX,
                y,
                size: sizePt,
                font,
                color: segmentColor,
                characterSpacing: letterSpacingPt,
              });
              cursorX +=
                font.widthOfTextAtSize(segment.text, sizePt) +
                Math.max(0, segment.text.length - 1) * letterSpacingPt;
              const next = segments[index + 1];
              if (next && segment.text.length > 0 && next.text.length > 0) {
                cursorX += letterSpacingPt;
              }
            }
          }
        }
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
          const childHeight = await renderElement(child, offsetX + element.xMm, offsetY + element.yMm + cursor);
          if (childHeight > 0) {
            cursor += childHeight + gapMm;
          }
        }
        return cursor;
      }
      case "qr": {
        if (element.visibility && !evaluateVisibility(element.visibility, context)) return 0;
        const data = resolveField(context, element.dataBinding);
        if (typeof data === "string") {
          if (data.length === 0) return 0;
          let img = imageCache.get(data);
          if (!img) {
            const base64 = data.includes(",") ? data.split(",")[1] : data;
            const pngBytes = Buffer.from(base64, "base64");
            img = await doc.embedPng(pngBytes);
            imageCache.set(data, img);
          }
          const sizeMm = element.sizeMm;
          const widthPt = mmToPt(sizeMm);
          const heightPt = mmToPt(sizeMm);
          const xMm = offsetXMm + offsetX + element.xMm;
          const yMm = offsetYMm + offsetY + element.yMm;
          const x = mmToPt(xMm);
          const y = mmToPt(pageHeightMm - yMm - sizeMm);
          page.drawImage(img, { x, y, width: widthPt, height: heightPt });
          return sizeMm;
        }

        if (data && typeof data === "object" && "modules" in (data as QrMatrixPayload)) {
          const payload = data as QrMatrixPayload;
          const modules = payload.modules;
          const moduleCount = modules.size ?? (modules.data ? Math.sqrt(modules.data.length) : 0);
          if (!moduleCount || Number.isNaN(moduleCount)) return 0;
          const sizeMm = element.sizeMm;
          const moduleMm = sizeMm / moduleCount;
          const xMm = offsetXMm + offsetX + element.xMm;
          const yMm = offsetYMm + offsetY + element.yMm;
          const baseX = mmToPt(xMm);
          const baseY = mmToPt(pageHeightMm - yMm - sizeMm);
          const darkColor = parseColor(payload.dark ?? "#000000");
          const lightColor = parseColor(payload.light ?? "");

          if (lightColor) {
            page.drawRectangle({
              x: baseX,
              y: baseY,
              width: mmToPt(sizeMm),
              height: mmToPt(sizeMm),
              color: lightColor,
            });
          }

          const useGet = typeof modules.get === "function";
          const dataArray = modules.data;
          for (let row = 0; row < moduleCount; row += 1) {
            for (let col = 0; col < moduleCount; col += 1) {
              const isDark = useGet
                ? Boolean(modules.get?.(row, col))
                : Boolean(dataArray && dataArray[row * moduleCount + col]);
              if (!isDark) continue;
              page.drawRectangle({
                x: baseX + mmToPt(col * moduleMm),
                y: baseY + mmToPt((moduleCount - 1 - row) * moduleMm),
                width: mmToPt(moduleMm),
                height: mmToPt(moduleMm),
                color: darkColor ?? rgb(0, 0, 0),
              });
            }
          }
          return sizeMm;
        }

        return 0;
      }
      default:
        return 0;
    }
  };

  for (const element of elements) {
    await renderElement(element);
  }
}

export async function generateOrderPdf(fields: OrderPdfFields, template: ResolvedTemplate) {
  const {
    name,
    role = "",
    seniority = "",
    email = "",
    phone = "",
    mobile = "",
    company = "",
    url = "",
    linkedin = "",
    photoUrl,
    qrPayload = null,
    address,
  } = fields;
  const normalizedUrl = normalizeWebUrl(url);
  const normalizedLinkedin = normalizeWebUrl(linkedin);
  const displayUrl = formatUrlForDisplay(url);
  const displayLinkedin = formatUrlForDisplay(linkedin);

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
  const companyLines = (company || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

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
  const cardWidthMm = template.pageWidthMm ?? 85;
  const cardHeightMm = template.pageHeightMm ?? 55;
  const offsetXMm = Math.max(0, (pageWidthMm - cardWidthMm) / 2);
  const offsetYMm = Math.max(0, (pageHeightMm - cardHeightMm) / 2);

  const pdfFonts: PdfFontPack = {
    regular: Frutiger.Light,
    bold: Frutiger.Bold,
    italic: Frutiger.LightItalic,
    boldItalic: Frutiger.Bold ?? Frutiger.LightItalic,
  };
  const disableTemplateFonts =
    ["1", "true", "yes"].includes((process.env.DISABLE_TEMPLATE_PDF_FONTS || "").toLowerCase());
  const templateFontsByFamily = disableTemplateFonts ? new Map() : await loadTemplateFonts(tplDoc, template);

  const frame = template.config.front.textFrame;

  const orgName = address?.companyName || (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";

  const hasDesignFront = Array.isArray(template.design?.front) && template.design!.front.length > 0;
  const hasDesignBack = Array.isArray(template.design?.back) && template.design!.back.length > 0;
  const designFrontHasQr = hasDesignFront && designContainsQr(template.design!.front);
  const designBackHasQr = hasDesignBack && designContainsQr(template.design!.back);
  const needsQrData = designFrontHasQr || designBackHasQr;
  const qrStyleRaw = findQrStyle(template.design?.front ?? []) ?? findQrStyle(template.design?.back ?? []);
  const qrStyle = qrStyleRaw
    ? { dark: qrStyleRaw.dark, light: qrStyleRaw.light }
    : null;

  let qrData: string | QrMatrixPayload | null = null;
  const disablePdfQr = ["1", "true", "yes"].includes((process.env.DISABLE_PDF_QR || "").toLowerCase());
  if (needsQrData && !disablePdfQr) {
    const payload =
      typeof qrPayload === "string" && qrPayload.trim().length > 0
        ? qrPayload.trim()
        : buildVCard3({
            fullName: name,
            org: orgName,
            title: role || undefined,
            seniority: seniority || undefined,
            email: email || undefined,
            phone: phone || undefined,
            mobile: mobile || undefined,
            url: normalizedUrl || undefined,
            linkedin: normalizedLinkedin || undefined,
            photoUrl: photoUrl || undefined,
            addrLabel,
            address: resolvedAddress,
          });
    const dark = normalizeQrColor(qrStyle?.dark, "#000000");
    const light = normalizeQrColor(qrStyle?.light, "#ffffff");
    const qrContent = String(payload ?? "").trim();
    if (!qrContent) {
      qrData = null;
    } else {
      try {
        const qrMatrix = QRCode.create(qrContent, { errorCorrectionLevel: "M" });
        qrData = {
          modules: qrMatrix.modules,
          dark,
          light,
        };
      } catch (error) {
        console.warn("[pdf] QR matrix generation failed", error);
        qrData = null;
      }
    }
  }

  const sharedContext = {
    name,
    role,
    seniority,
    email,
    phone,
    mobile,
    company,
    companyPrimary,
    companyLines,
    companySecondary: (() => {
      if (companyLines.length > 1) return companyLines.slice(1).join(" | ");
      const parts: string[] = [];
      if (resolvedAddress.street) parts.push(resolvedAddress.street);
      const postalCity = [resolvedAddress.postalCode, resolvedAddress.city].filter(Boolean).join(" ").trim();
      if (postalCity) parts.push(postalCity);
      if (resolvedAddress.country) parts.push(resolvedAddress.country);
      const candidate = parts.filter(Boolean).join(" | ");
      if (candidate) return candidate;
      return "";
    })(),
    url: displayUrl,
    linkedin: displayLinkedin,
    address: resolvedAddress,
    qrData,
  };

  if (hasDesignFront) {
    await renderDesignElementsToPdf({
      doc: tplDoc,
      page: front,
      elements: template.design!.front,
      context: sharedContext,
      fonts: pdfFonts,
      fontsByFamily: templateFontsByFamily,
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
    if (displayUrl) contactLines.push(displayUrl);
    if (displayLinkedin) contactLines.push(displayLinkedin);

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

  if (hasDesignBack) {
    await renderDesignElementsToPdf({
      doc: tplDoc,
      page: back,
      elements: template.design!.back,
      context: sharedContext,
      fonts: pdfFonts,
      fontsByFamily: templateFontsByFamily,
      cardWidthMm,
      cardHeightMm,
      pageWidthMm,
      pageHeightMm,
      offsetXMm,
      offsetYMm,
    });
  }

  const pdfBytes = await tplDoc.save();
  return { pdfBytes, fontReport: report };
}
