// app/api/pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

// mm → pt
const mm2pt = (mm: number) => (mm * 72) / 25.4;

type Payload = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;   // mehrzeilig (Textarea)
  url?: string;       // optional expliziter QR-Link; sonst mailto:email
  template?: string;  // z. B. "omicron"
};

// Textarea-Zeilenumbrüche erhalten
const splitLinesMultiline = (s: string) =>
  s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());

// ---- Frutiger laden (Light, LightItalic, Bold) direkt ins Template-Dokument ----
async function loadFrutiger(doc: PDFDocument) {
  const base = path.join(process.cwd(), "public", "fonts");

  const files = {
    Light: path.join(base, "FrutigerLTPro-Light.ttf"),
    LightItalic: path.join(base, "FrutigerLTPro-LightItalic.ttf"),
    Bold: path.join(base, "FrutigerLTPro-Bold.ttf"),
  } as const;

  const fonts: Partial<Record<keyof typeof files, PDFFont>> = {};
  const report: string[] = [];

  for (const [key, p] of Object.entries(files) as Array<[keyof typeof files, string]>) {
    if (!existsSync(p)) {
      report.push(`MISSING ${key}: ${p}`);
      continue;
    }
    try {
      const bytes = await readFile(p);
      const f = await doc.embedFont(bytes, { subset: true });
      // kleiner Glyph-Test (Umlaute)
      void f.widthOfTextAtSize("ÄÖÜ äöü ß", 10);
      fonts[key] = f;
      report.push(`EMBEDDED ${key}: ${Math.round(bytes.byteLength / 1024)} kB`);
    } catch (e: any) {
      report.push(`EMBED ERROR ${key}: ${e?.message || String(e)}`);
    }
  }

  return { fonts, report };
}

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

  // --- 1) Template laden (wir bearbeiten es "in place") ---
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
  }
  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);

  // Wichtig: fontkit im Template-Dokument registrieren
  tplDoc.registerFontkit(fontkit);

  // --- 2) Frutiger-Schnitte einbetten (Light, LightItalic, Bold) ---
  const { fonts: Frutiger, report } = await loadFrutiger(tplDoc);

  // --- 3) Seiten referenzieren ---
  if (tplDoc.getPageCount() < 2) {
    return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
  }
  const front = tplDoc.getPage(0); // Vorderseite: Text
  const back  = tplDoc.getPage(1); // Rückseite: QR
  const { height: fh } = front.getSize();

  // --- 4) Vorderseite beschriften (mm-Positionen anpassen) ---
  const left = mm2pt(24.4); // von links
  let y = fh - mm2pt(4);    // von oben

  const draw = (txt: string, size = 9, font?: PDFFont) => {
    if (!txt) return;
    front.drawText(txt, {
      x: left,
      y,
      size,
      font: font ?? undefined,
      color: rgb(0, 0, 0),
    });
    y -= mm2pt(5);
  };

  // Name bold, Rolle italic, Rest light
  draw(name, 10, Frutiger.Bold);
  draw(role, 8, Frutiger.LightItalic ?? Frutiger.Light);
  draw(email, 8, Frutiger.Light);
  draw(phone, 8, Frutiger.Light);

  if (company) {
    y -= mm2pt(2);
    for (const line of splitLinesMultiline(company)) {
      if (!line) { y -= mm2pt(4); continue; }
      draw(line, 8, Frutiger.Light);
    }
  }

  // --- 5) Rückseite: QR in 32 mm, ohne Quiet Zone (kommt vom Design) ---
  const target = url || (email ? `mailto:${email}` : "");
  if (target) {
    const dataUrl = await QRCode.toDataURL(target, {
      width: 1024,
      margin: 0,
      errorCorrectionLevel: "M",
    });
    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await tplDoc.embedPng(pngBytes);

    const qrSize = mm2pt(32); // 32 mm Kantenlänge
    const qx = mm2pt(52.8);
    const qy = mm2pt(18.85);

    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

    // Optional: klickbare Fläche fürs On-Screen-PDF
    // back.annotate({ type: "link", rect: [qx, qy, qx + qrSize, qy + qrSize], url: target });
  }

  // --- 6) Speichern – Template bleibt mit allen Profilen/Boxen erhalten ---
  const bytes = await tplDoc.save();

  // Uint8Array → ArrayBuffer (für NextResponse kompatibel)
  const abuf = new ArrayBuffer(bytes.length);
  new Uint8Array(abuf).set(bytes);

  // Optional: Debug-Header aktivieren mit ?debug=1
  const isDebug = new URL(req.url).searchParams.has("debug");
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="card.pdf"',
  };
  if (isDebug) headers["X-Font-Debug"] = (report.join(" | ")).slice(0, 1800);

  return new NextResponse(abuf, { headers });
}
