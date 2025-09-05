"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // multiline
  url?: string;
  /** Feintuning nur für die Preview (in mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie wie im PDF (mm) ---------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;
const TOP_MM = 24;

const GAP_NAME_MM = 4;
const GAP_CONTACT_MM = 3.5;
const CONTACT_BLOCK_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

/* PDF-Schriftgrößen (pt) → mm */
const ptToMm = (pt: number) => (pt * 25.4) / 72;
const NAME_MM = ptToMm(10); // 10pt
const ROLE_MM = ptToMm(8);  // 8pt
const BODY_MM = ptToMm(8);  // 8pt

/* QR-Position (mm) – leicht korrigiert, damit er schön in die weiße Fläche passt */
const QR_DEFAULT = {
  xMm: 49.8,   // etwas weiter links
  yMm: 17.6,   // etwas weiter oben
  sizeMm: 29.0 // etwas kleiner
};

/* -------- Helpers -------- */
const splitLines = (s?: string) =>
  (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);

// vCard
function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function buildVCard3(o: {
  fullName: string; org?: string; title?: string; email?: string; tel?: string; url?: string; addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = o;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEscape(fullName)}`];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** beobachtet die gerenderte Breite und liefert px pro mm */
function usePxPerMm(ref: React.RefObject<HTMLDivElement>) {
  const [pxPerMm, setPxPerMm] = useState<number>(3); // Fallback
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const wPx = el.clientWidth;
      if (wPx > 0) setPxPerMm(wPx / CARD_W_MM);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return pxPerMm;
}

/* ======================================================================= */
/* FRONT                                                                    */
/* ======================================================================= */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // y-Akkumulator wie im PDF (mm)
  let y = TOP_MM;
  const nameY = y;
  y += GAP_NAME_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_MM;

  y += CONTACT_BLOCK_SPACER_MM;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) { contacts.push({ text: `T +${phone.replace(/^\+/, "")}`, y }); y += GAP_CONTACT_MM; }
  if (email) { contacts.push({ text: email, y }); y += GAP_CONTACT_MM; }
  if (url)   { contacts.push({ text: url, y }); y += GAP_CONTACT_MM; }

  y += COMPANY_SPACER_MM;

  const addr = splitLines(company).map((text, i) => ({ text, y: y + i * GAP_CONTACT_MM }));

  // dynamische Font-Skalierung
  const wrapRef = useRef<HTMLDivElement>(null);
  const pxPerMm = usePxPerMm(wrapRef);
  const NAME_PX = NAME_MM * pxPerMm;
  const ROLE_PX = ROLE_MM * pxPerMm;
  const BODY_PX = BODY_MM * pxPerMm;

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ height: "auto", display: "block" }}
        aria-label="Business card front"
      >
        {/* Hintergrund */}
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />
        {/* Text (Koordinaten in mm, Schrift in px → skaliert korrekt) */}
        <g
          fontFamily='"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
          fill="black"
          dominantBaseline="alphabetic"
        >
          <text x={LEFT_MM} y={nameY} style={{ fontSize: NAME_PX, fontWeight: 700 }}>
            {name}
          </text>

          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              style={{ fontSize: ROLE_PX, fontStyle: "italic", fontWeight: 300, opacity: 0.9 }}
            >
              {role}
            </text>
          )}

          {contacts.map((l, i) => (
            <text key={`c-${i}`} x={LEFT_MM} y={l.y} style={{ fontSize: BODY_PX, fontWeight: 300 }}>
              {l.text}
            </text>
          ))}

          {addr.map((l, i) => (
            <text key={`a-${i}`} x={LEFT_MM} y={l.y} style={{ fontSize: BODY_PX, fontWeight: 300 }}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

/* ======================================================================= */
/* BACK                                                                     */
/* ======================================================================= */
export function BusinessCardBack(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "", qrOverride } = props;

  const org = splitLines(company)[0] ?? "";
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel: company || undefined,
      }),
    [name, role, email, phone, url, company, org]
  );

  const [qrData, setQrData] = useState<string>("");

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const data = await QRCode.toDataURL(vcard, {
          margin: 0,
          errorCorrectionLevel: "M",
          scale: 8,
        });
        if (!stop) setQrData(data);
      } catch {
        if (!stop) setQrData("");
      }
    })();
    return () => {
      stop = true;
    };
  }, [vcard]);

  const qx = qrOverride?.xMm ?? QR_DEFAULT.xMm;
  const qy = qrOverride?.yMm ?? QR_DEFAULT.yMm;
  const qs = qrOverride?.sizeMm ?? QR_DEFAULT.sizeMm;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ height: "auto", display: "block" }}
        aria-label="Business card back"
      >
        <image
          href="/templates/omicron-back.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />
        {qrData && <image href={qrData} x={qx} y={qy} width={qs} height={qs} preserveAspectRatio="none" />}
      </svg>
    </div>
  );
}
