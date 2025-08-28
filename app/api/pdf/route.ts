// app/api/pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import * as QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

const mm2pt = (mm: number) => (mm * 72) / 25.4;

type Payload = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;   // mehrzeilig aus <Textarea>
  url?: string;       // optional: expliziter QR-Link; sonst mailto:email
  template?: string;  // default "omicron"
};

// Zeilenumbrüche aus Textarea konservieren
function splitLinesMultiline(input: string) {
  return input.replace(/\r\n/g, "\n").split("\n").map((s) => s.trimEnd());
}

// Robuster Frutiger-Loader mit Logging/Report
async function loadFrutiger(outDoc: PDFDocument) {
  const base = path.join(process.cwd(), "public", "fonts");
  const files = {
    Light: path.join(base, "FrutigerLTPro-Light.otf"),
    LightItalic: path.join(base, "FrutigerLTPro-LightItalic.otf"),
    Bold: path.join(base, "FrutigerLTPro-Bold.otf"),
  } as const;

  const report: string[] = [];
  const fonts: Partial<Record<keyof typeof files, PDFFont>> = {};

  for (const [key, p] of Object.entries(files) as Array<[keyof typeof files, string]>) {
    if (!existsSync(p)) {
      report.push(`MISSING ${key}: ${p}`);
      continue;
    }
    try {
      const bytes = await readFile(p);
      const f = await outDoc.embedFont(bytes, { subset: true });
      // schneller Glyph-Test (Umlaute etc.)
      void f.widthOfTextAtSize("ÄÖÜ äöü ß .,:+-", 10);
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

  // 1) Vorlage laden (erwartet 2 Seiten Front/Back)
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
  }
  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);

  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);

  // 2) Frutiger laden (Light, LightItalic, Bold)
  const { fonts: Frutiger, report } = await loadFrutiger(outDoc);

  // 3) Template-Seiten kopieren (TrimBox/ICC/Spot bleiben erhalten)
  const pages = await outDoc.copyPages(tplDoc, tplDoc.getPageIndices());
  pages.forEach((p) => outDoc.addPage(p));

  if (outDoc.getPageCount() < 2) {
    return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
  }

  const front = outDoc.getPage(0); // Vorderseite: Text + Adresse
  const back = outDoc.getPage(1);  // Rückseite: QR
  const { height: fh } = front.getSize();

  // 4) Front beschriften (Positionen mm-genau anpassen)
  const left = mm2pt(24.4);   // von links
  let y = fh - mm2pt(4);      // von oben

  const draw = (txt: string, size = 9, font?: PDFFont) => {
    if (!txt) return;
    front.drawText(txt, {
      x: left,
      y,
      size,
      font: font ?? undefined, // falls nicht geladen → pdf-lib Default
      color: rgb(0, 0, 0),
    });
    y -= mm2pt(5);
  };

  // Name fett, Rolle kursiv, Rest Light
  draw(name, 10, Frutiger.Bold);
  draw(role, 8, Frutiger.LightItalic ?? Frutiger.Light);
  draw(email, 8, Frutiger.Light);
  draw(phone, 8, Frutiger.Light);

  // Firmenadresse (Textarea → echte Zeilenumbrüche)
  if (company) {
    y -= mm2pt(2);
    const lines = splitLinesMultiline(company);
    for (const line of lines) {
      if (!line) {
        y -= mm2pt(4); // Leerzeile = zusätzlicher Abstand
        continue;
      }
      draw(line, 8, Frutiger.Light);
    }
  }

  // 5) Back: QR (hochauflösend PNG ohne Quiet Zone; Größe fix 32 mm)
  const target = url || (email ? `mailto:${email}` : "");
  if (target) {
    const dataUrl = await QRCode.toDataURL(target, {
      width: 1024,
      margin: 0, // Quiet Zone übernimmt dein weißes Feld im Template
      errorCorrectionLevel: "M",
    });
    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await outDoc.embedPng(pngBytes);

    const qrSize = mm2pt(32);      // 32 mm Kante
    const qx = mm2pt(52.8);        // an Weißfeld anpassen
    const qy = mm2pt(18.85);

    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

    // Optional: klickbarer Link im On-Screen-PDF
    // back.annotate({ type: "link", rect: [qx, qy, qx + qrSize, qy + qrSize], url: target });
  }

  // 6) Response (ArrayBuffer, Node/Vercel-safe)
  const bytes = await outDoc.save();
  const abuf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(abuf).set(bytes);

  // Optional: Debug-Header aktivieren mit ?debug=1
  const isDebug = new URL(req.url).searchParams.has("debug");
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="card.pdf"',
  };
  if (isDebug) headers["X-Font-Debug"] = report.join(" | ").slice(0, 1800);

  return new NextResponse(abuf, { headers });
}
