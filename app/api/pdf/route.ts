// app/api/pdf/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
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
  return input.replace(/\r\n/g, "\n").split("\n").map(s => s.trimEnd());
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

  // --- 1) Vorlage laden (erwartet 2 Seiten: Front/Back) ---
  const tplPath = path.join(process.cwd(), "public", "templates", `${template}.pdf`);
  if (!existsSync(tplPath)) {
    return NextResponse.json({ error: `Template not found: ${template}.pdf` }, { status: 400 });
  }
  const tplBytes = await readFile(tplPath);
  const tplDoc = await PDFDocument.load(tplBytes);

  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit); // wichtig: OTF/Unicode

  // Frutiger OTFs laden (achte auf exakte Dateinamen im Repo)
  let Frutiger: { Light?: any; Bold?: any } = {};
  try {
    const fReg = await readFile(path.join(process.cwd(), "public", "fonts", "FrutigerLTPro-Light.otf")); // ggf. -Regular.otf
    const fBold = await readFile(path.join(process.cwd(), "public", "fonts", "FrutigerLTPro-Bold.otf"));
    Frutiger = {
      Light: await outDoc.embedFont(fLight, { subset: true }),
      Bold:    await outDoc.embedFont(fBold, { subset: true }),
    };
  } catch {
    // Falls Fonts fehlen: pdf-lib-Standardfont verwenden (okay für erste Tests)
  }

  const pages = await outDoc.copyPages(tplDoc, tplDoc.getPageIndices());
  pages.forEach(p => outDoc.addPage(p)); // Template bleibt unverändert (TrimBox/ICC/Spot erhalten)

  if (outDoc.getPageCount() < 2) {
    return NextResponse.json({ error: "Template must have 2 pages (front/back)" }, { status: 400 });
  }

  const front = outDoc.getPage(0); // Vorderseite: Text + Adresse
  const back  = outDoc.getPage(1); // Rückseite: QR
  const { height: fh } = front.getSize();
  const { width: bw, height: bh } = back.getSize();

  // --- 2) Front beschriften ---
  // Positionen bitte bei Bedarf mm-genau anpassen:
  const left = mm2pt(24);        // 24 mm vom linken Rand
  let y = fh - mm2pt(22);        // 22 mm von oben

  const draw = (txt: string, size = 9, font: any = Frutiger.Regular) => {
    if (!txt) return;
    front.drawText(txt, { x: left, y, size, font, color: rgb(0, 0, 0) });
    y -= mm2pt(5);
  };

  // Name fett, Rest Light
  draw(name, 10, Frutiger.Bold ?? undefined);
  draw(role, 8, Frutiger.Light ?? undefined);
  draw(email, 8, Frutiger.Light ?? undefined);
  draw(phone, 8, Frutiger.Light ?? undefined);

  // Firmenadresse (Textarea → echte Zeilenumbrüche)
  if (company) {
    y -= mm2pt(2);
    const lines = splitLinesMultiline(company);
    for (const line of lines) {
      if (!line) { y -= mm2pt(4); continue; } // Leerzeile = zusätzlicher Abstand
      draw(line, 8, Frutiger.Light ?? undefined);
    }
  }

  // --- 3) Back: QR (hochauflösend, margin:0; Größe fix 27 mm) ---
  const target = url || (email ? `mailto:${email}` : "");
  if (target) {
    const dataUrl = await QRCode.toDataURL(target, {
      width: 1024,           // sehr scharf bei 27 mm Endmaß
      margin: 0,             // keine Quiet Zone im PNG – kommt aus deinem Design/Weißfeld
      errorCorrectionLevel: "M",
    });

    const pngBytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const img = await outDoc.embedPng(pngBytes);

    const qrSize = mm2pt(32);   // QR 32 mm Kantenlänge (fix)
    // Diese Koordinaten bitte an dein Weißfeld anpassen:
    const qx = mm2pt(52.8);
    const qy = mm2pt(18.85);

    back.drawImage(img, { x: qx, y: qy, width: qrSize, height: qrSize });

    // Optional: macht den QR im Screen-PDF klickbar
    // back.annotate({ type: "link", rect: [qx, qy, qx + qrSize, qy + qrSize], url: target });
  }

  // --- 4) Response: sauberer ArrayBuffer (TS/Vercel-safe) ---
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
