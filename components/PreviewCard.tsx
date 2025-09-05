"use client";

import { useEffect, useMemo, useState } from "react";

// 85 x 55 mm Karte
const CARD_W_MM = 85;
const CARD_H_MM = 55;
const MM2PX = (mm: number) => mm * 3.7795275591; // 96dpi CSS mm->px

// Deine Layout-Werte (identisch zur PDF-Route)
const LEFT_MM = 24.4;
const COL_W_MM = 85;   // du nutzt volle Breite links (kannst reduzieren)
const TOP_MM  = 24;    // Abstand von oben zur ersten Grundlinie
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // multi-line
  url?: string;
};

export function BusinessCardFront({ name, role="", email="", phone="", company="", url = ""}: Props) {
  // Positions in px
  const left = MM2PX(LEFT_MM);
  const colWidth = MM2PX(COL_W_MM);
  const topY = MM2PX(TOP_MM);

  // Typo sizes (px, matching roughly your PDF sizes)
  const namePx = 10 * 1.333; // 10pt ≈ 13.33px
  const rolePx =  8 * 1.333;
  const bodyPx =  8 * 1.333;

  // Build lines like in PDF
  const lines: Array<{ text: string; size: number; weight?: number; italic?: boolean; dyMm?: number }> = [];

  // Name bold
  lines.push({ text: name, size: namePx, weight: 700, dyMm: 0 });

  // Role
  if (role) lines.push({ text: role, size: rolePx, weight: 300, italic: true, dyMm: GAP_NAME_MM });

  // Spacer
  lines.push({ text: "", size: bodyPx, dyMm: 3.25 });

  // Contacts
  if (phone) lines.push({ text: `T ${phone}`, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
  if (email) lines.push({ text: email, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
  if (url)   lines.push({ text: url, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });

  // Spacer to company
  lines.push({ text: "", size: bodyPx, dyMm: 1.9 });

  // Company multiline
  if (company) {
    const parts = company.replace(/\r\n/g, "\n").split("\n");
    for (const p of parts) {
      lines.push({ text: p, size: bodyPx, weight: 300, dyMm: GAP_BODY_MM });
    }
  }

  // Accumulate y positions
  let y = topY;
  const positioned = [];
  for (let i = 0; i < lines.length; i++) {
    const { dyMm = (i === 0 ? 0 : GAP_BODY_MM) } = lines[i];
    if (i !== 0) y -= MM2PX(dyMm);
    positioned.push({ ...lines[i], y });
  }

  return (
    <div
      className="relative font-frutiger select-none"
      style={{
        width:  MM2PX(CARD_W_MM),
        height: MM2PX(CARD_H_MM),
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

export function BusinessCardBack({ email, url }: Props) {
  // QR: 32 mm @ Position (52.8mm, 18.85mm)
  const qrSize = MM2PX(32);
  const qx = MM2PX(52.8);
  const qy = MM2PX(18.85);

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
      const { toDataURL } = await import("qrcode"); // client-only
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
        width:  MM2PX(CARD_W_MM),
        height: MM2PX(CARD_H_MM),
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
