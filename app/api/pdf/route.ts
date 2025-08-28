import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import * as QRCode from "qrcode";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const runtime = "nodejs"; // fs in Vercel Functions erlauben
const mm2pt = (mm: number) => (mm * 72) / 25.4;

export async function POST(req: Request) {
  const { name, role = "", email = "", phone = "", url = "", template = "basic" } = await req.json();

  // 1) Vorlage laden (falls vorhanden), sonst leere 85×55mm-Seite
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  let outDoc: PDFDocument;

  if (existsSync(tplPath)) {
    const tplBytes = await readFile(tplPath);
    const tplDoc = await PDFDocument.load(tplBytes);
    outDoc = await PDFDocument.create();
    const pages = await outDoc.copyPages(tplDoc, tplDoc.getPageIndices());
    pages.forEach((p) => outDoc.addPage(p)); // Template bleibt unverändert
  } else {
    outDoc = await PDFDocument.create();
    outDoc.addPage([mm2pt(85), mm2pt(55)]);
  }

  const page = outDoc.getPage(0);
  const { width, height } = page.getSize();

  // 2) Text (Standardfont reicht für den Test)
  const left = mm2pt(12);
  let y = height - mm2pt(18);
  if (name)  { page.drawText(name,  { x: left, y, size: 10, color: rgb(0, 0, 0) }); y -= mm2pt(5); }
  if (role)  { page.drawText(role,  { x: left, y, size: 8.5, color: rgb(0, 0, 0) }); y -= mm2pt(5); }
  if (email) { page.drawText(email, { x: left, y, size: 8.5, color: rgb(0, 0, 0) }); y -= mm2pt(5); }
  if (phone) { page.drawText(phone, { x: left, y, size: 8.5, color: rgb(0, 0, 0) }); }

  // 3) QR (mailto oder URL)
  const target = url || (email ? `mailto:${email}` : "");
  if (target) {
    const dataUrl = await QRCode.toDataURL(target);
    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await outDoc.embedPng(pngBytes);
    const size = mm2pt(18);
    page.drawImage(img, { x: width - mm2pt(12) - size, y: mm2pt(8), width: size, height: size });
  }

  // 4) Uint8Array -> *reiner* ArrayBuffer (kein SharedArrayBuffer in der Union)
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
