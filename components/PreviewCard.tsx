"use client";

import { useEffect, useMemo, useState } from "react";

// Karte 85 × 55 mm
const CARD_W_MM = 85;
const CARD_H_MM = 55;
const mm2px = (mm: number) => mm * 3.7795275591; // 96dpi CSS-Umrechnung

// Layout-Werte (identisch zur PDF-Route)
const LEFT_MM = 24.4;
const COL_W_MM = 85; // volle Breite (anpassbar)
const TOP_MM = 24;
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

// ------ Prop-Typen getrennt ------
type FrontProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  url?: string;
};

type BackProps = {
  email?: string;
  url?: string;
};

// ------ Front: Texte exakt positioniert ------
export function BusinessCardFront({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  url = "",
}: FrontProps) {
  const left = mm2px(LEFT_MM);
  const colWidth = mm2px(COL_W_MM);
  const topY = mm2px(TOP_MM);

  // pt → px (≈ *1.333)
  const namePx = 10 * 1.333; // 10pt
  const rolePx = 8 * 1.333;  // 8pt
  const bodyPx = 8 * 1.333;  // 8pt

  type L = { text: string; size: number; weight?: number; italic?: boolean; dyMm?: number };
  const lines: L[] = [];

  // Name bold
  lines.push({ text: name, size: namePx, weight: 700, dyMm: 0 });

  // Rolle (italic)
  if (role) lines.push({ text: role, size: rolePx, weight: 300, italic: true, dyMm: GAP_NAME_MM });

  // Abstand zu Kontakten
  lines.push({ text: "", size: bodyPx, dyMm: 3.25 });

  // Kontakte
  if (phone) lines.push({ text: `T ${phone}`, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
  if (email) lines.push({ text: email, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
  if (url)   lines.push({ text: url, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });

  // Abstand zu Firma
  lines.push({ text: "", size: bodyPx, dyMm: 1.9 });

  // Firma (mehrzeilig)
  if (company) {
    const parts = company.replace(/\r\n/g, "\n").split("\n");
    for (const p of parts) {
      lines.push({ text: p, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
    }
  }

  // y-Koordinaten aufsummieren
  let y = topY;
  const positioned = lines.map((l, i) => {
    const dy = i === 0 ? 0 : (l.dyMm ?? GAP_BODY_MM);
    y -= mm2px(dy);
    return { ...l, y };
  });

  return (
    <div
      className="relative select-none font-frutiger"
      style={{
        width: mm2px(CARD_W_MM),
        height: mm2px(CARD_H_MM),
        backgroundImage: `url(/templates/omicron-front.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {positioned.map((l, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left,
            top: l.y,
            width: colWidth,
            lineHeight: 1,
            fontSize: l.size,
            fontWeight: l.weight ?? 300,
            fontStyle: l.italic ? "italic" : "normal",
            color: "#000",
            whiteSpace: "pre-wrap",
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ------ Back: QR exakt positioniert ------
export function BusinessCardBack({ email, url }: BackProps) {
  // QR 32 mm bei (52.8 mm, 18.85 mm)
  const qrSize = mm2px(32);
  const qx = mm2px(52.8);
  const qy = mm2px(18.85);

  const target = useMemo(() => {
    if (url) return url;
    if (email) return `mailto:${email}`;
    return "";
  }, [url, email]);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function gen() {
      if (!target) { setQrDataUrl(""); return; }
      const { toDataURL } = await import("qrcode"); // nur Client
      const dataUrl = await toDataURL(target, { width: 512, margin: 0, errorCorrectionLevel: "M" });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    gen();
    return () => { cancelled = true; };
  }, [target]);

  return (
    <div
      className="relative select-none"
      style={{
        width: mm2px(CARD_W_MM),
        height: mm2px(CARD_H_MM),
        backgroundImage: `url(/templates/omicron-back.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR"
          style={{
            position: "absolute",
            left: qx,
            top: qy,
            width: qrSize,
            height: qrSize,
          }}
        />
      )}
    </div>
  );
}
