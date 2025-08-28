// app/api/pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

// ---------- Helpers ----------
const mm2pt = (mm: number) => (mm * 72) / 25.4;

// vCard-Helfer
function vEscape(s: string) {
  // RFC 2426: \ , ; und Zeilenumbrüche escapen
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildVCard3(opts: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  tel?: string;
  url?: string;
  addrLabel?: string; // freie Adresse (mehrzeilig)
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`,
  ];

  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);

  // Unstrukturierte Firmenadresse als Label (kompatibel & simpel)
  if (addrLabel) {
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  }

  lines.push("END:VCARD");
  // Wichtig: CRLF für breite Scanner-Kompatibilität
  return lines.join("\r\n");
}

type Payload = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;   // mehrzeilig (Textarea)
  url?: string;       // expliziter QR-Link; sonst mailto:email
  template?: string;  // z. B. "omicron"
};

const splitLinesMultiline = (s: string) =>
  s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());

type Align = "left" | "center" | "right";

// einfacher Zeilenumbruch nach Worten (mit Notfall-Hardbreak bei zu langen Wörtern)
function wrapText(text: string, maxWidthPt: number, font: PDFFont, sizePt: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let buf = "";

  for (const w of words) {
    const next = buf ? buf + " " + w : w;
    const width = font.widthOfTextAtSize(next, sizePt);
    if (width <= maxWidthPt) {
      buf = next;
    } else {
      if (buf) lines.push(buf);
      // Wort ist alleine länger als maxWidth -> hart stückeln
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
  opts: { xLeftPt: number; widthPt: number; size: number; font?: PDFFont; align?: Align; color?: { r: number; g: number; b: number } }
) {
  const { xLeftPt, widthPt, size, font, align = "left", color = rgb(0, 0, 0) } = opts;
  const f = font ?? undefined;
  const w = f ? f.widthOfTextAtSize(text, size) : 0;
  let x = xLeftPt;
  if (align === "center") x = xLeftPt + (widthPt - w) / 2;
  if (align === "right") x = xLeftPt + widthPt - w;

  page.drawText(text, { x, y: yPt, size, font: f, color });
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

// ---------- Fonts: TTF bevorzugt, OTF Fallback ----------
async function loadFrutiger(doc: PDFDocument) {
  const base = path.join(process.cwd(), "public", "fonts");
  // Reihenfolge: TTF -> OTF
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
    let picked: string | null = null;
    for (const p of list) {
      if (existsSync(p)) { picked = p; break; }
    }
    if (!picked) {
      report.push(`MISSING ${String(key)}: ${list.join(" | ")}`);
      continue;
    }
    try {
      const bytes = await readFile(picked);
      const f = await doc.embedFont(bytes, { subset: true });
      void f.widthOfTextAtSize("ÄÖÜ äöü ß", 10); // Smoke-Test
      fonts[key] = f;
      report.push(`EMBEDDED ${String(key)} (${path.basename(picked)}): ${Math.round(bytes.byteLength / 1024)} kB`);
    } catch (e: any) {
      report.push(`EMBED ERROR ${String(key)}: ${e?.message || String(e)}`);
    }
  }
  return { fonts, report };
}

// ---------- Route ----------
export async function POST(req: Request) {
  const body = (await req.json()) as Payload;

  const {
    name,
    role = "",
    email = "",
    phone = "",
    company = "",
    url = "",
    template = "omicron",
  } = body;

  // 1) Template laden (in place bearbeiten)
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
  }
  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);

  // fontkit im Template registrieren
  tplDoc.registerFontkit(fontkit);

  // 2) Frutiger laden
  const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

  // 3) Seiten referenzieren
  if (tplDoc.getPageCount() < 2) {
    return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
  }
  const front = tplDoc.getPage(0);
  const back = tplDoc.getPage(1);
  const { height: fh, width: fw } = front.getSize(); // fw nur falls du mittig setzen willst

  // 4) Vorderseite – Spaltenlayout (wie Referenz)
  // Geometrie (mm)
  const L = 24.4;   // linker Rand
  const W = 85;     // Spaltenbreite
  const TOP = 24;   // Abstand von oben zur ersten Grundlinie

  const xLeft = mm2pt(L);
  const colWidth = mm2pt(W);
  let y = fh - mm2pt(TOP);

  // Typo
  const nameSize = 10;
  const roleSize = 8;
  const bodySize = 8;
  const lineGap = 4; // mm

  // NAME (Bold)
  y = drawBlock(front, [name], y, {
    xLeftPt: xLeft, widthPt: colWidth, size: nameSize, lhMm: lineGap, font: Frutiger.Bold, align: "left",
  });

  // ROLLE (LightItalic)
  if (role) {
    y = drawBlock(front, [role], y, {
      xLeftPt: xLeft, widthPt: colWidth, size: roleSize, lhMm: lineGap, font: (Frutiger.LightItalic ?? Frutiger.Light), align: "left",
    });
  }

  // Abstand zu Kontakten
  y -= mm2pt(3.25);
  const lineGaps = 3.5; // mm
  
  // KONTAKTE (weicher Umbruch falls sehr lang)
  const contactLines: string[] = [];
  if (phone) contactLines.push(`T ${phone}`);
  if (email) contactLines.push(email);
  if (url)   contactLines.push(url);

  for (const line of contactLines) {
    const lines = Frutiger.Light ? wrapText(line, colWidth, Frutiger.Light, bodySize) : [line];
    y = drawBlock(front, lines, y, {
      xLeftPt: xLeft, widthPt: colWidth, size: bodySize, lhMm: lineGaps, font: Frutiger.Light, align: "left",
    });
  }

  // Abstand zu Firma/Adresse
  y -= mm2pt(1.9);

  // FIRMA/ADRESSE (Textarea → Zeilen, dann bei Bedarf umbrechen)
  if (company) {
    const raw = splitLinesMultiline(company).filter(Boolean);
    const wrapped: string[] = [];
    for (const l of raw) {
      if (Frutiger.Light) wrapped.push(...wrapText(l, colWidth, Frutiger.Light, bodySize));
      else wrapped.push(l);
    }
    y = drawBlock(front, wrapped, y, {
      xLeftPt: xLeft, widthPt: colWidth, size: bodySize, lhMm: lineGaps, font: Frutiger.Light, align: "left",
    });
  }

  // --- 5) Rückseite – QR: vCard statt URL ----------------------------
const orgName = (company || "").split(/\r?\n/)[0] || ""; // 1. Zeile als ORG
const addrLabel = company || "";                         // gesamte Adresse als Label

const vcard = buildVCard3({
  fullName: name,
  org: orgName,
  title: role || undefined,
  email: email || undefined,
  tel: phone || undefined,
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

const qrSize = mm2pt(32);      // 32 mm
const qx = mm2pt(52.8);
const qy = mm2pt(18.85);

back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

// Optional anklickbarer Link weglassen (ist ja jetzt ein vCard-QR)

    // Optional anklickbar im On-Screen-PDF:
    // back.annotate({ type: "link", rect: [qx, qy, qx + qrSize, qy + qrSize], url: target });
  }

  // 6) Speichern (Template bleibt mit ICC/TrimBox etc. erhalten)
  const bytes = await tplDoc.save();

  // Uint8Array → ArrayBuffer (NextResponse erwartet BodyInit)
  const abuf = new ArrayBuffer(bytes.length);
  new Uint8Array(abuf).set(bytes);

  // Debug-Header bei Bedarf
  const isDebug = new URL(req.url).searchParams.has("debug");
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="card.pdf"',
  };
  if (isDebug) headers["X-Font-Debug"] = (report.join(" | ")).slice(0, 1800);

  return new NextResponse(abuf, { headers });
}
