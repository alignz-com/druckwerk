// app/api/pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, grayscale, type PDFFont, type Color } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { formatPhones } from "@/lib/formatPhones";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

// ---------- Helpers ----------
const mm2pt = (mm: number) => (mm * 72) / 25.4;

// vCard-Helfer
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
  phone?: string;   // WORK
  mobile?: string;  // MOBILE
  url?: string;
  addrLabel?: string; // multiline label shown by many scanners
}) {
  const { fullName, org, title, email, phone, mobile, url, addrLabel } = opts;

  const { given, family } = splitName(fullName);
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEscape(family)};${vEscape(given)};;;`,
    `FN:${vEscape(fullName)}`,
  ];

  if (org)    lines.push(`ORG:${vEscape(org)}`);
  if (title)  lines.push(`TITLE:${vEscape(title)}`);
  if (phone)  lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(phone)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,MOBILE:${vEscape(mobile)}`);
  if (email)  lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)    lines.push(`URL:${vEscape(url)}`);

  if (addrLabel) {
    // ADR: PO Box ; Extended ; Street ; City ; Region ; Postal ; Country
    const adr = ["", "", vEscape(addrLabel), "", "", "", ""].join(";");
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":${adr}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n"); // CRLF for compatibility
}

type Payload = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string; 
  company?: string;   // mehrzeilig (Textarea)
  url?: string;       // optional zusätzlich in vCard
  template?: string;  // z. B. "omicron"
};

const splitLinesMultiline = (s: string) =>
  s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());

type Align = "left" | "center" | "right";

// simpler Wortumbruch
function wrapText(text: string, maxWidthPt: number, font: PDFFont, sizePt: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? buf + " " + w : w;
    if (font.widthOfTextAtSize(next, sizePt) <= maxWidthPt) {
      buf = next;
    } else {
      if (buf) lines.push(buf);
      if (font.widthOfTextAtSize(w, sizePt) > maxWidthPt) {
        // harter Break in zu langen Einzelwörtern
        let cut = "";
        for (const ch of w) {
          const t = cut + ch;
          if (font.widthOfTextAtSize(t, sizePt) > maxWidthPt) {
            lines.push(cut);
            cut = ch;
          } else cut = t;
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
    color?: Color; // <— pdf-lib Color statt {r,g,b}
    }
  ) {
  const { xLeftPt, widthPt, size, font, align = "left", color = grayscale(0) } = opts;
  const f = font ?? undefined;
  const w = f ? f.widthOfTextAtSize(text, size) : 0;
  let x = xLeftPt;
  if (align === "center") x = xLeftPt + (widthPt - w) / 2;
  if (align === "right") x = xLeftPt + widthPt - w;
  page.drawText(text, { x, y: yPt, size, font: f, color }); // Color ist jetzt Gray
}

function drawBlock(
  page: any,
  lines: string[],
  startY: number,
  opts: { xLeftPt: number; widthPt: number; size: number; lhMm: number; font?: PDFFont; align?: Align }
) {
  const { xLeftPt, widthPt, size, lhMm, font, align } = opts;
  let y = startY;
  for (const line of lines) {
    drawLine(page, line, y, { xLeftPt, widthPt, size, font, align });
    y -= mm2pt(lhMm);
  }
  return y;
}

// Fonts: TTF bevorzugt, OTF Fallback
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
      const f = await doc.embedFont(bytes, { subset: true });
      void f.widthOfTextAtSize("ÄÖÜ äöü ß", 10);
      fonts[key] = f;
      report.push(`EMBEDDED ${String(key)} (${path.basename(picked)}): ${Math.round(bytes.byteLength / 1024)} kB`);
    } catch (e: any) {
      report.push(`EMBED ERROR ${String(key)}: ${e?.message || String(e)}`);
    }
  }
  return { fonts, report };
}

// ---------- Route ----------
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Payload;
    const {
      name,
      role = "",
      email = "",
      phone = "",
      mobile = "",
      company = "",
      url = "",
      template = "omicron",
    } = body;

    // 1) Template laden
    const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
    if (!existsSync(tplPath)) {
      return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
    }
    const tplBytes = await readFile(tplPath);
    const tplDoc = await PDFDocument.load(tplBytes);
    tplDoc.registerFontkit(fontkit);

    // 2) Fonts
    const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

    // 3) Seiten
    if (tplDoc.getPageCount() < 2) {
      return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
    }
    const front = tplDoc.getPage(0);
    const back = tplDoc.getPage(1);
    const { height: fh } = front.getSize();

    // 4) Vorderseite – Inhalte setzen
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

    // Name
    y = drawBlock(front, [name], y, {
      xLeftPt: xLeft, widthPt: colWidth, size: nameSize, lhMm: lineGap,
      font: Frutiger.Bold, align: "left",
    });

    // Rolle
    if (role) {
      y = drawBlock(front, [role], y, {
        xLeftPt: xLeft, widthPt: colWidth, size: roleSize, lhMm: lineGap,
        font: (Frutiger.LightItalic ?? Frutiger.Light), align: "left",
      });
    }

    y -= mm2pt(3.25);

    // Kontakte
    const contactLines: string[] = [];
    const phoneLine = formatPhones(phone, mobile);
    if (phoneLine) contactLines.push(phoneLine);
    if (email) contactLines.push(email);
    if (url) contactLines.push(url);

    for (const line of contactLines) {
      const lines = Frutiger.Light ? wrapText(line, colWidth, Frutiger.Light, bodySize) : [line];
      y = drawBlock(front, lines, y, {
        xLeftPt: xLeft, widthPt: colWidth, size: bodySize, lhMm: lineGapBody,
        font: Frutiger.Light, align: "left",
      });
    }

    y -= mm2pt(1.9);

    // Firma/Adresse
    if (company) {
      const raw = splitLinesMultiline(company).filter(Boolean);
      const wrapped: string[] = [];
      for (const l of raw) {
        if (Frutiger.Light) wrapped.push(...wrapText(l, colWidth, Frutiger.Light, bodySize));
        else wrapped.push(l);
      }
      y = drawBlock(front, wrapped, y, {
        xLeftPt: xLeft, widthPt: colWidth, size: bodySize, lhMm: lineGapBody,
        font: Frutiger.Light, align: "left",
      });
    }

    // 5) Rückseite – QR
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

    // 6) Speichern
    const bytes = await tplDoc.save();

    // Debug-Flag
    const urlObj = new URL(req.url);
    const isDebug = urlObj.searchParams.has("debug");

    if (isDebug) {
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="preview.pdf"',
      };
      if (report?.length) headers["X-Font-Debug"] = report.join(" | ").slice(0, 1800);

      const debugBlob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      return new NextResponse(debugBlob, { headers });
    }

    // Upload zu Vercel Blob
    const orderId = Date.now().toString();
    const fileName = `orders/order_${orderId}.pdf`;
    const pdfBlob = new Blob([bytes as BlobPart], { type: "application/pdf" });

    const { url: blobUrl } = await put(fileName, pdfBlob, {
      access: "public",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN, // ✅ Token aus Env nutzen
    });

    return NextResponse.json({
      message: "✅ Bestellung erhalten",
      fileUrl: blobUrl,
    });

  } catch (err: any) {
    console.error("❌ PDF API Fehler:", err);
      return NextResponse.json(
        { error: err?.message || "Unbekannter Fehler" },
        { status: 500 }
      );
  }
}