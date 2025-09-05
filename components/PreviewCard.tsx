"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

// ----- Konstanten: Karte 85 × 55 mm -----
const CARD_MM_W = 85;
const CARD_MM_H = 55;
const BASE_PX_W = 1000;                 // interne Renderbreite
const PX_PER_MM = BASE_PX_W / CARD_MM_W;
const mm = (n: number) => n * PX_PER_MM;
const pt = (n: number) => (n * 96) / 72; // 1pt = 1.3333px @96dpi

// Layout wie in deiner PDF-Route:
const LEFT_MM = 24.4;   // Textspalte: linker Rand
const TOP_MM  = 24;     // erste Grundlinie von oben
const COL_W_MM = 85;    // Breite der (weichen) Textspalte

// Abstände
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

// vCard-Builder (wie in /api/pdf)
const vEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
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
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEscape(fullName)}`];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// Kleiner Helfer zum Auto-Scale
export function AutoScale({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.min(1, Math.max(0.3, w / width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

// Trim-/Schnittmarken (optional)
function CropMarks() {
  const L = 5; // mm Länge
  const T = 2; // mm vom Rand nach innen
  const s = { position: "absolute" as const, background: "rgba(0,0,0,.6)" };
  return (
    <>
      {/* oben links */}
      <div style={{ ...s, left: mm(T), top: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, left: mm(T), top: mm(T), width: 1, height: mm(L) }} />
      {/* oben rechts */}
      <div style={{ ...s, right: mm(T), top: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, right: mm(T), top: mm(T), width: 1, height: mm(L) }} />
      {/* unten links */}
      <div style={{ ...s, left: mm(T), bottom: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, left: mm(T), bottom: mm(T), width: 1, height: mm(L) }} />
      {/* unten rechts */}
      <div style={{ ...s, right: mm(T), bottom: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, right: mm(T), bottom: mm(T), width: 1, height: mm(L) }} />
    </>
  );
}

// ---------- FRONT ----------
export function BusinessCardFront(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  backgroundSrc: string;
  frame?: boolean;
}) {
  const { name, role = "", email = "", phone = "", company = "", backgroundSrc, frame } = props;

  // Zeilen (nur Top-Down – exakt wie PDF)
  const namePx = pt(10);
  const rolePx = pt(8);
  const bodyPx = pt(8);

  const xLeft = mm(LEFT_MM);
  const firstBaseY = mm(TOP_MM);

  type Line = { text: string; sizePx: number; dyMm: number; className?: string };
  const lines: Line[] = [];

  // Name (Bold)
  lines.push({ text: name, sizePx: namePx, dyMm: 0, className: "font-bold" });
  // Rolle (LightItalic)
  if (role) lines.push({ text: role, sizePx: rolePx, dyMm: GAP_NAME_MM, className: "italic font-light" });
  // Abstand
  lines.push({ text: "", sizePx: bodyPx, dyMm: 3.25 });

  // Kontakte
  if (phone) lines.push({ text: `T ${phone}`, sizePx: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });
  if (email) lines.push({ text: email,       sizePx: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });
  // URL lassen wir im Front-Mock weg (dein PDF hat’s im Kontakt-Block; falls gewünscht, hier einkommentieren)
  // if (url)   lines.push({ text: url,         sizePx: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });

  // Abstand zu Firma
  lines.push({ text: "", sizePx: bodyPx, dyMm: 1.9 });

  // Firma/Adresse (mehrzeilig)
  const addr = (company || "").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  for (const l of addr) lines.push({ text: l, sizePx: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });

  // Render
  let y = firstBaseY;

  return (
    <div
      className="relative rounded-2xl bg-white"
      style={{
        width: BASE_PX_W,
        height: mm(CARD_MM_H),
        border: frame ? "1px solid rgba(0,0,0,.08)" : undefined,
        boxShadow: frame ? "0 8px 20px rgba(0,0,0,.06)" : undefined,
      }}
    >
      <img
        src={backgroundSrc}
        alt=""
        className="absolute inset-0 h-full w-full rounded-2xl object-cover"
        draggable={false}
      />

      {/* Textspalte */}
      <div className="absolute" style={{ left: xLeft, top: 0, width: mm(COL_W_MM), height: "100%" }}>
        {lines.map((l, i) => {
          if (i > 0) y += mm(l.dyMm);
          if (!l.text) return null;
          return (
            <div
              key={i}
              className={l.className}
              style={{
                position: "absolute",
                left: 0,
                top: y,
                fontSize: l.sizePx,
                lineHeight: 1,
                color: "#000",
                whiteSpace: "pre-wrap",
              }}
            >
              {l.text}
            </div>
          );
        })}
      </div>

      {frame && <CropMarks />}
    </div>
  );
}

// ---------- BACK ----------
export function BusinessCardBack(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  vcard?: boolean;        // wenn true → vCard-QR; sonst URL/mailto
  backgroundSrc: string;
  frame?: boolean;
}) {
  const { name, role = "", email = "", phone = "", company = "", url = "", vcard = true, backgroundSrc, frame } = props;

  // Ziel für QR
  const orgName = (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";
  const qrPayload = vcard
    ? buildVCard3({ fullName: name, org: orgName, title: role || undefined, email: email || undefined, tel: phone || undefined, url: url || undefined, addrLabel })
    : (url || (email ? `mailto:${email}` : ""));

  // QR DataURL
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    if (!qrPayload) return;
    QRCode.toDataURL(qrPayload, { width: 1024, margin: 0, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [qrPayload]);

  // Position (PDF-Matching: x,y von links/unten)
  const qrSizeMM = 32;
  const qxMM = 52.8;
  const qyMM = 18.85;

  return (
    <div
      className="relative rounded-2xl bg-white"
      style={{
        width: BASE_PX_W,
        height: mm(CARD_MM_H),
        border: frame ? "1px solid rgba(0,0,0,.08)" : undefined,
        boxShadow: frame ? "0 8px 20px rgba(0,0,0,.06)" : undefined,
      }}
    >
      <img
        src={backgroundSrc}
        alt=""
        className="absolute inset-0 h-full w-full rounded-2xl object-cover"
        draggable={false}
      />

      {qr && (
        <img
          src={qr}
          alt="QR"
          className="absolute"
          style={{
            left: mm(qxMM),
            bottom: mm(qyMM),
            width: mm(qrSizeMM),
            height: mm(qrSizeMM),
          }}
          draggable={false}
        />
      )}

      {frame && <CropMarks />}
    </div>
  );
}
