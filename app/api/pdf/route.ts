import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import * as QRCode from "qrcode";
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
  company?: string;   // <- neu: Firmenadresse
  url?: string;       // optional: falls du QR explizit per URL setzen willst
  template?: string;  // "omicron"
};

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

  // 1) Vorlage laden (2-seitig)
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
  }
  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);

  const outDoc = await PDFDocument.create();
  const pages = await outDoc.copyPages(tplDoc, tplDoc.getPageIndices());
  pages.forEach((p) => outDoc.addPage(p)); // behält X-4/Trimbox etc.

  // Safety: Wir erwarten 2 Seiten
  if (outDoc.getPageCount() < 2) {
    return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
  }

  const front = outDoc.getPage(0); // Vorderseite: Text + Adresse
  const back  = outDoc.getPage(1); // Rückseite: QR
  const { width: fw, height: fh } = front.getSize();
  const { width: bw, height: bh } = back.getSize();

  // 2) Optional: Corporate Font einbetten (wenn du willst)
  //    Font-Datei unter public/fonts/Inter-Regular.ttf bereitstellen
  let font: any = undefined;
  try {
    const fontBytes = await readFile(path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf"));
    font = await outDoc.embedFont(fontBytes);
  } catch { /* fallback: Standardfont */ }

  // ---- Koordinaten (BEISPIEL, bitte mm-genau anpassen) ----
  // Front: linke Spalte
  const left = mm2pt(24);     // 12 mm vom linken Rand
  let y = fh - mm2pt(22);     // 20 mm von oben

  const draw = (txt: string, size = 9) => {
    if (!txt) return;
    front.drawText(txt, { x: left, y, size, font, color: rgb(0,0,0) });
    y -= mm2pt(5);
  };

  // 3) FRONT: Texte & Firmenadresse
  draw(name, 10.5);
  draw(role, 9);
  draw(email, 9);
  draw(phone, 9);

  if (company) {
    y -= mm2pt(2); // kleiner Abstand
    // Tipp: Adresse kann länger sein – evtl. in 2 Zeilen splitten:
    const parts = company.split(" · "); // z. B. "Alignz AG · Seestrasse 12 · 8000 Zürich"
    for (const p of parts) draw(p, 8.5);
  }

  // 4) BACK: QR-Code ONLY (mittig oder rechts unten) – HIGH-RES PNG
  const target = url || (email ? `mailto:${email}` : "");
  if (target) {
    // hohe Auflösung & kein Außenrand für druckscharfen QR
    const dataUrl = await QRCode.toDataURL(target, {
      width: 1024,               // ~1024 px => sehr sauber bei 37 mm
      margin: 5,                 // kein weißer Rand
      errorCorrectionLevel: "M", // stabil; "Q" oder "H" wenn du später ein Logo überlegst
    });
  
    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await outDoc.embedPng(pngBytes);
  
    // deine mm-Positionen/Größe
    const qrSize = mm2pt(37);
    const qx = mm2pt(50.3);
    const qy = mm2pt(16.35);
    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });
  }

  // 5) Sauberer ArrayBuffer-Body (TS/Edge-safe)
  const bytes = await outDoc.save();
  const abuf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(abuf).set(bytes);

  return new NextResponse(abuf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="card.pdf"',
    },
  });
}
