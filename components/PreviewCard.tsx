"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as QRCode from "qrcode";

// ---------- Konstanten (mm-basierte Geometrie, wie in der PDF-Route) ----------
const CARD_W_MM = 85;      // Kartenbreite
const CARD_H_MM = 55;      // Kartenhöhe
const L_MM       = 24.4;   // linke Spalte: Abstand links
const W_MM       = 85;     // Spaltenbreite (wie in PDF)
const TOP_MM     = 24;     // erste Grundlinie von oben

const GAP_NAME_ROLE_MM = 4;
const GAP_BODY_MM      = 3.5;
const GAP_TO_CONTACTS_MM = 3.25;
const GAP_TO_COMPANY_MM  = 1.9;

// QR (Rückseite)
const QR_SIZE_MM = 32;
const QR_X_MM    = 52.8;
const QR_Y_MM    = 18.85;

// Schriftgrößen (pt -> px). 1pt = 96/72 px ≈ 1.3333
const PT2PX = 96 / 72;
const NAME_PT = 10;
const ROLE_PT = 8;
const BODY_PT = 8;
const NAME_PX = NAME_PT * PT2PX; // ≈ 13.33
const ROLE_PX = ROLE_PT * PT2PX; // ≈ 10.67
const BODY_PX = BODY_PT * PT2PX; // ≈ 10.67

// mm -> px (Basisskala). Wir definieren 4 px pro mm (ergibt 340×220 px unskaliert)
const pxPerMm = 4;
const mm = (val: number) => val * pxPerMm;

// ---------- Hook: skaliert den Inhalt, damit er responsiv in den Wrapper passt ----------
function useFitScale(ref: React.RefObject<HTMLDivElement>, baseWidthPx: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const ro = new ResizeObserver(() => {
      const wrapW = el.clientWidth;
      if (!wrapW) return;
      const s = wrapW / baseWidthPx;
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, baseWidthPx]);
  return scale;
}

// ---------- vCard-Helfer (wie in deiner API) ----------
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
  addrLabel?: string; // freie mehrzeilige Adresse
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines: string[] = [
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

// ---------- Front (Vorderseite) ----------
export function BusinessCardFront(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  bgSrc?: string;   // optional: /templates/omicron_front.png
}) {
  const { name, role = "", email = "", phone = "", company = "", bgSrc = "/templates/omicron_front.png" } = props;

  // Wrapper & Skalierung
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseWidthPx = mm(CARD_W_MM);
  const scale = useFitScale(wrapRef, baseWidthPx);

  // y-Akkumulator (von oben nach unten, wie PDF)
  const y0 = TOP_MM;
  let y = y0;

  const lines: React.ReactElement[] = [];

  // Name (Bold, 10pt)
  lines.push(
    <div
      key="name"
      style={{
        position: "absolute",
        left: mm(L_MM),
        top: mm(y),
        width: mm(W_MM),
        fontFamily: "Frutiger LT Pro",
        fontWeight: 700,
        fontSize: NAME_PX,
        lineHeight: 1,
      }}
    >
      {name}
    </div>
  );
  y += GAP_NAME_ROLE_MM;

  // Rolle (Light Italic, 8pt)
  if (role) {
    lines.push(
      <div
        key="role"
        style={{
          position: "absolute",
          left: mm(L_MM),
          top: mm(y),
          width: mm(W_MM),
          fontFamily: "Frutiger LT Pro",
          fontStyle: "italic",
          fontWeight: 300,
          fontSize: ROLE_PX,
          lineHeight: 1,
        }}
      >
        {role}
      </div>
    );
    y += GAP_NAME_ROLE_MM;
  }

  // Abstand zu Kontakten
  y += GAP_TO_CONTACTS_MM;

  // Kontakte (Light, 8pt)
  const contact: string[] = [];
  if (phone) contact.push(`T ${phone}`);
  if (email) contact.push(email);
  // URL steht bei dir im Preview nicht auf der Front (entspricht PDF-Front)

  for (const [i, t] of contact.entries()) {
    lines.push(
      <div
        key={`contact-${i}`}
        style={{
          position: "absolute",
          left: mm(L_MM),
          top: mm(y),
          width: mm(W_MM),
          fontFamily: "Frutiger LT Pro",
          fontWeight: 300,
          fontSize: BODY_PX,
          lineHeight: 1,
          whiteSpace: "pre-wrap",
          opacity: 0.9,
        }}
      >
        {t}
      </div>
    );
    y += GAP_BODY_MM;
  }

  // Abstand zu Firma
  y += GAP_TO_COMPANY_MM;

  // Firma/Adresse (mehrzeilig)
  if (company) {
    const addrLines = company.replace(/\r\n/g, "\n").split("\n");
    for (const [i, t] of addrLines.entries()) {
      lines.push(
        <div
          key={`addr-${i}`}
          style={{
            position: "absolute",
            left: mm(L_MM),
            top: mm(y),
            width: mm(W_MM),
            fontFamily: "Frutiger LT Pro",
            fontWeight: 300,
            fontSize: BODY_PX,
            lineHeight: 1,
            whiteSpace: "pre",
            opacity: 0.9,
          }}
        >
          {t}
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
        {/* Hintergrundbild der Vorderseite (keine Ecken/Radius/Shadow) */}
        <img
          src={bgSrc}
          alt="Card Front"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
          }}
        />
        {/* Text-Layer */}
        {lines}
      </div>
    </div>
  );
}

// ---------- Back (Rückseite mit vCard-QR) ----------
export function BusinessCardBack(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig → ORG (erste Zeile) + LABEL
  url?: string;
  bgSrc?: string;   // optional: /templates/omicron_back.png
}) {
  const {
    name,
    role = "",
    email = "",
    phone = "",
    company = "",
    url = "",
    bgSrc = "/templates/omicron_back.png",
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const baseWidthPx = mm(CARD_W_MM);
  const scale = useFitScale(wrapRef, baseWidthPx);

  // vCard bauen
  const org = (company || "").split(/\r?\n/)[0] || "";
  const vcardStr = useMemo(
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

  // QR als DataURL erzeugen
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(vcardStr, {
          width: 1024,
          margin: 0,
          errorCorrectionLevel: "M",
        });
        if (active) setQrDataUrl(dataUrl);
      } catch {
        if (active) setQrDataUrl("");
      }
    })();
    return () => {
      active = false;
    };
  }, [vcardStr]);

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
        {/* Hintergrundbild der Rückseite */}
        <img
          src={bgSrc}
          alt="Card Back"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
          }}
        />

        {/* QR an der exakten PDF-Position */}
        {qrDataUrl && (
          <img
            src={qrDataUrl}
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
