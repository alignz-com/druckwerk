"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as QRCode from "qrcode";

// ----- Geometrie (mm) – exakt wie im PDF -----
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const L_MM = 24.4;     // linker Rand (Textspalte)
const TOP_MM = 24;     // Abstand von oben zur 1. Grundlinie
const W_MM = 85;       // Spaltenbreite

const GAP_NAME_ROLE_MM = 4;      // Abstand Name↔Rolle
const GAP_BODY_MM = 3.5;         // Zeilenabstand Body
const GAP_TO_CONTACTS_MM = 3.25; // Abstand Rolle→Kontakte
const GAP_TO_COMPANY_MM = 1.9;   // Abstand Kontakte→Firma

// Rückseite – QR (mm)
const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

// Punkte→Pixel (CSS) für Schriftgrößen (pdf-lib nutzt 72 dpi, CSS 96 dpi)
const PT2PX = 96 / 72;
const NAME_PX = 10 * PT2PX;
const ROLE_PX = 8 * PT2PX;
const BODY_PX = 8 * PT2PX;

// mm→px (einfaches Preview-Raster, unabhängig vom späteren Scale)
const PX_PER_MM = 4;
const mm = (v: number) => v * PX_PER_MM;

// Hintergrundbilder (bitte existierende Dateien eintragen)
const BG_FRONT = "/templates/omicron_front.png";
const BG_BACK  = "/templates/omicron_back.png";

// ---------- kleiner Helper: Scale auf Wrapperbreite ----------
function useFitScale(ref: React.RefObject<HTMLDivElement | null>, baseWidthPx: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1;
      setScale(w / baseWidthPx);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, baseWidthPx]);
  return scale;
}

// ---------- vCard Builder (wie API) ----------
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
    `FN:${vEscape(fullName)}`
  ];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ---------- Vorderseite ----------
export function BusinessCardFront(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  bgSrc?: string;
}) {
  const { name, role = "", email = "", phone = "", company = "", bgSrc = BG_FRONT } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(wrapRef, mm(CARD_W_MM));

  // y von oben nach unten – identisch zur PDF-Rechnung
  let y = TOP_MM;
  const els: React.ReactElement[] = [];

  // Name (Bold 10pt)
  els.push(
    <div key="name" style={{
      position: "absolute",
      left: mm(L_MM),
      top: mm(y),
      width: mm(W_MM),
      fontFamily: "Frutiger LT Pro",
      fontWeight: 700,
      fontSize: NAME_PX,
      lineHeight: 1,
    }}>
      {name}
    </div>
  );
  y += GAP_NAME_ROLE_MM;

  // Rolle (LightItalic 8pt)
  if (role) {
    els.push(
      <div key="role" style={{
        position: "absolute",
        left: mm(L_MM),
        top: mm(y),
        width: mm(W_MM),
        fontFamily: "Frutiger LT Pro",
        fontStyle: "italic",
        fontWeight: 300,
        fontSize: ROLE_PX,
        lineHeight: 1,
      }}>
        {role}
      </div>
    );
    y += GAP_NAME_ROLE_MM;
  }

  // Abstand zu Kontakten
  y += GAP_TO_CONTACTS_MM;

  // Kontakte (Light 8pt)
  if (phone) {
    els.push(
      <div key="phone" style={{
        position: "absolute",
        left: mm(L_MM),
        top: mm(y),
        fontFamily: "Frutiger LT Pro",
        fontWeight: 300,
        fontSize: BODY_PX,
        lineHeight: 1,
      }}>
        T {phone}
      </div>
    );
    y += GAP_BODY_MM;
  }
  if (email) {
    els.push(
      <div key="email" style={{
        position: "absolute",
        left: mm(L_MM),
        top: mm(y),
        fontFamily: "Frutiger LT Pro",
        fontWeight: 300,
        fontSize: BODY_PX,
        lineHeight: 1,
      }}>
        {email}
      </div>
    );
    y += GAP_BODY_MM;
  }

  // Abstand zu Firmenblock
  y += GAP_TO_COMPANY_MM;

  // Firmenadresse (mehrzeilig)
  if (company) {
    for (const [i, line] of company.split(/\r?\n/).entries()) {
      els.push(
        <div key={`c-${i}`} style={{
          position: "absolute",
          left: mm(L_MM),
          top: mm(y),
          fontFamily: "Frutiger LT Pro",
          fontWeight: 300,
          fontSize: BODY_PX,
          lineHeight: 1,
        }}>
          {line}
        </div>
      );
      y += GAP_BODY_MM;
    }
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          position: "relative",
          width: mm(CARD_W_MM),
          height: mm(CARD_H_MM),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <BgImage src={bgSrc} alt="Card Front" />
        {els}
      </div>
    </div>
  );
}

// ---------- Rückseite ----------
export function BusinessCardBack(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  bgSrc?: string;
}) {
  const { name, role = "", email = "", phone = "", company = "", url = "", bgSrc = BG_BACK } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(wrapRef, mm(CARD_W_MM));

  const org = (company || "").split(/\r?\n/)[0] || "";
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org: org || undefined,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel: company || undefined,
      }),
    [name, org, role, email, phone, url, company]
  );

  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    let on = true;
    (async () => {
      const data = await QRCode.toDataURL(vcard, { width: 1024, margin: 0, errorCorrectionLevel: "M" });
      if (on) setQr(data);
    })();
    return () => { on = false; };
  }, [vcard]);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          position: "relative",
          width: mm(CARD_W_MM),
          height: mm(CARD_H_MM),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <BgImage src={bgSrc} alt="Card Back" />
        {qr && (
          <img
            src={qr}
            alt="vCard QR"
            style={{
              position: "absolute",
              left: mm(QR_X_MM),
              top: mm(QR_Y_MM),
              width: mm(QR_SIZE_MM),
              height: mm(QR_SIZE_MM),
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Helfer: robustes <img> mit Fallback ----------
function BgImage({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  // Wenn Bildpfad nicht existiert → kleiner Hinweis statt Fragezeichen
  if (!ok) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "#fff",
          border: "1px dashed #e2e8f0",
          color: "#94a3b8",
          fontSize: 12,
          fontFamily: "ui-sans-serif",
        }}
      >
        Missing: {src}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setOk(false)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
