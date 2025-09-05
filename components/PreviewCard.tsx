"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

/**
 * Geometrie / Maße
 * – Wir rendern die Karte in einem fixen Pixel-Rahmen (BASE_PX_W),
 *   rechnen aber ALLES in mm bzw. pt (wie im PDF) und konvertieren dann.
 */

const CARD_MM_W = 85.0;           // Kartenbreite (85 mm)
const CARD_MM_H = 54.0;           // Kartenhöhe (54 mm)
const BASE_PX_W = 1000;           // Renderbreite in Pixel für die Preview
const pxPerMm   = BASE_PX_W / CARD_MM_W;

const mm = (n: number) => n * pxPerMm;
const ptToPx = (pt: number) => mm(pt * 0.3527777778); // 1 pt = 0.35278 mm

// Layout (EXAKT wie in deiner PDF-Route)
const LEFT_MM       = 24.4;  // Textspalte: linker Rand
const TOP_MM        = 24.0;  // erste Grundlinie Abstand von oben
const COL_W_MM      = 85.0;  // Spaltenbreite (du nutzt volle Breite)
const NAME_PT       = 10;
const ROLE_PT       = 8;
const BODY_PT       = 8;
const GAP_NAME_MM   = 4.0;   // Name/Rolle Zeilenabstand
const GAP_BODY_MM   = 3.5;   // Body Zeilenabstand
const GAP_CONTACT_MM= 3.25;  // Abstand Rolle → Kontakt
const GAP_TO_COMP_MM= 1.9;   // Abstand Kontakt → Adresse

// Rückseite QR (wie PDF)
const QR_SIZE_MM = 32.0;
const QR_X_MM    = 52.8;
const QR_Y_MM    = 18.85;

// Hilfen
function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildVCard3(opts: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  tel?: string;
  url?: string;
  addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`,
    ...(org   ? [`ORG:${vEscape(org)}`] : []),
    ...(title ? [`TITLE:${vEscape(title)}`] : []),
    ...(tel   ? [`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`] : []),
    ...(email ? [`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`] : []),
    ...(url   ? [`URL:${vEscape(url)}`] : []),
    ...(addrLabel ? [`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`] : []),
    "END:VCARD",
  ];
  return lines.join("\r\n");
}

type CommonProps = {
  /** PNG oder SVG der Template-Seite im /public/templates  (optional; sonst blank) */
  backgroundSrc?: string;
  /** Rahmen + Schnittmarken anzeigen */
  frame?: boolean;
};

export type FrontProps = CommonProps & {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
};

export function BusinessCardFront({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  backgroundSrc = "/templates/omicron-front.png",
  frame = true,
}: FrontProps) {

  // Spalten-Startkoordinate (in px)
  const xLeft = mm(LEFT_MM);
  const firstBaseY = mm(TOP_MM);

  // Textblöcke (Reihenfolge/Abstände wie PDF)
  const lines = useMemo(() => {
    const L: Array<{ text: string; sizePx: number; dyMm: number; className?: string }> = [];

    // Name (Bold)
    L.push({ text: name, sizePx: ptToPx(NAME_PT), dyMm: 0, className: "frutiger-bold" });

    // Rolle (LightItalic)
    if (role) {
      L.push({ text: role, sizePx: ptToPx(ROLE_PT), dyMm: GAP_NAME_MM, className: "frutiger-light frutiger-italic" });
    }

    // Abstand zu Kontakten
    L.push({ text: "", sizePx: ptToPx(BODY_PT), dyMm: GAP_CONTACT_MM });

    // Kontakte
    if (phone) L.push({ text: `T ${phone}`, sizePx: ptToPx(BODY_PT), dyMm: GAP_BODY_MM, className: "frutiger-light" });
    if (email) L.push({ text: email,        sizePx: ptToPx(BODY_PT), dyMm: GAP_BODY_MM, className: "frutiger-light" });
    // URL in der Preview zeigen (wie im PDF-Kontaktblock)
    // (Wenn du sie nicht willst, einfach auskommentieren.)
    // if (url)   L.push({ text: url,          sizePx: ptToPx(BODY_PT), dyMm: GAP_BODY_MM, className: "frutiger-light" });

    // Abstand zu Firma
    L.push({ text: "", sizePx: ptToPx(BODY_PT), dyMm: GAP_TO_COMP_MM });

    // Firmenadresse (mehrzeilig)
    if (company) {
      const parts = company.replace(/\r\n/g, "\n").split("\n");
      for (const p of parts) {
        L.push({ text: p, sizePx: ptToPx(BODY_PT), dyMm: GAP_BODY_MM, className: "frutiger-light text-muted-foreground" });
      }
    }

    return L;
  }, [name, role, email, phone, company]);

  // Wir positionieren jede Zeile untereinander ab erster Grundlinie.
  // In PDF rechnest du von oben nach unten – hier genauso.
  let cursorY = firstBaseY;

  return (
    <div
      className="relative rounded-2xl bg-white"
      style={{
        width: BASE_PX_W,
        height: mm(CARD_MM_H),
        boxShadow: frame ? "0 0 0 1px rgba(0,0,0,.08)" : undefined,
      }}
    >
      {/* Hintergrund-Template */}
      {backgroundSrc ? (
        <img
          src={backgroundSrc}
          alt=""
          className="absolute inset-0 h-full w-full rounded-2xl object-cover"
          draggable={false}
        />
      ) : null}

      {/* Textspalte */}
      <div
        className="absolute"
        style={{
          left: xLeft,
          top: 0,
          width: mm(COL_W_MM),
          height: "100%",
        }}
      >
        {lines.map((l, i) => {
          if (i === 0) {
            // erste Zeile beginnt bei firstBaseY
            cursorY = firstBaseY;
          } else {
            cursorY += mm(l.dyMm);
          }
          return (
            <div
              key={i}
              className={l.className}
              style={{
                position: "absolute",
                left: 0,
                top: cursorY,
                transform: "translateY(-50%)", // Basislinie ~ mittig ausgleichen
                fontSize: l.sizePx,
                lineHeight: 1,
                color: "black",
                whiteSpace: "pre-wrap",
              }}
            >
              {l.text}
            </div>
          );
        })}
      </div>

      {/* optionale Schnittmarken */}
      {frame && <CropMarks />}
    </div>
  );
}

export type BackProps = CommonProps & {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  url?: string;
  /** Wenn true, rendert QR als vCard (wie PDF). Sonst direkt URL/mailto. */
  vcard?: boolean;
};

export function BusinessCardBack({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  url = "",
  vcard = true,
  backgroundSrc = "/templates/omicron-back.png",
  frame = true,
}: BackProps) {
  const [qrSrc, setQrSrc] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        let payload = "";
        if (vcard) {
          const orgName = (company || "").split(/\r?\n/)[0] || "";
          const addrLabel = company || "";
          payload = buildVCard3({
            fullName: name,
            org: orgName,
            title: role || undefined,
            email: email || undefined,
            tel: phone || undefined,
            url: url || undefined,
            addrLabel,
          });
        } else {
          payload = url || (email ? `mailto:${email}` : "");
        }

        const dataUrl = await QRCode.toDataURL(payload, {
          width: 1024,
          margin: 0,
          errorCorrectionLevel: "M",
        });
        setQrSrc(dataUrl);
      } catch {
        setQrSrc("");
      }
    })();
  }, [name, role, email, phone, company, url, vcard]);

  return (
    <div
      className="relative rounded-2xl bg-white"
      style={{
        width: BASE_PX_W,
        height: mm(CARD_MM_H),
        boxShadow: frame ? "0 0 0 1px rgba(0,0,0,.08)" : undefined,
      }}
    >
      {backgroundSrc ? (
        <img
          src={backgroundSrc}
          alt=""
          className="absolute inset-0 h-full w-full rounded-2xl object-cover"
          draggable={false}
        />
      ) : null}

      {/* QR exakt wie im PDF */}
      {qrSrc && (
        <img
          src={qrSrc}
          alt="QR"
          className="absolute"
          style={{
            left: mm(QR_X_MM),
            bottom: mm(QR_Y_MM), // PDF-Koordinaten gemessen von unten; hier deshalb bottom
            width: mm(QR_SIZE_MM),
            height: mm(QR_SIZE_MM),
          }}
          draggable={false}
        />
      )}

      {frame && <CropMarks />}
    </div>
  );
}

/** kleine Schnittmarken wie im Screenshot */
function CropMarks() {
  const mark = 6; // mm
  const inset = 3; // mm nach innen
  const s = {
    w: 1,
    color: "rgba(0,0,0,.5)",
  };
  return (
    <>
      {/* oben links */}
      <div style={{ position: "absolute", left: mm(inset), top: mm(inset), width: mm(mark), height: s.w, background: s.color }} />
      <div style={{ position: "absolute", left: mm(inset), top: mm(inset), width: s.w, height: mm(mark), background: s.color }} />
      {/* oben rechts */}
      <div style={{ position: "absolute", right: mm(inset), top: mm(inset), width: mm(mark), height: s.w, background: s.color }} />
      <div style={{ position: "absolute", right: mm(inset), top: mm(inset), width: s.w, height: mm(mark), background: s.color }} />
      {/* unten links */}
      <div style={{ position: "absolute", left: mm(inset), bottom: mm(inset), width: mm(mark), height: s.w, background: s.color }} />
      <div style={{ position: "absolute", left: mm(inset), bottom: mm(inset), width: s.w, height: mm(mark), background: s.color }} />
      {/* unten rechts */}
      <div style={{ position: "absolute", right: mm(inset), bottom: mm(inset), width: mm(mark), height: s.w, background: s.color }} />
      <div style={{ position: "absolute", right: mm(inset), bottom: mm(inset), width: s.w, height: mm(mark), background: s.color }} />
    </>
  );
}
