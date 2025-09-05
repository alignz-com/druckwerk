/* components/PreviewCard.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  url?: string;     // optional in vCard
};

/* ---------- Konstanten (in mm & pt, ident zu deiner PDF-Route) ---------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;   // linker Rand der Textspalte
const TOP_MM = 24;      // Baseline der ersten Zeile von oben
const GAP_NAME_MM = 4;  // Abstand Name -> Rolle (und Rolle -> nächster Block)
const GAP_CONTACT_MM = 3.5; // Zeilenabstand im Body
const CONTACT_BLOCK_SPACER_MM = 3.25; // Rolle -> Kontakte
const COMPANY_SPACER_MM = 1.9;        // Kontakte -> Firma

const NAME_PT = 10;           // Bold
const ROLE_PT = 8;            // Light Italic
const BODY_PT = 8;            // Light

// QR auf Rückseite (in mm, wie im PDF)
const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

/* ---------- vCard-Helper ---------- */
function vEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
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
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`,
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

/* ---------- Gemeinsame kleine Helpers ---------- */
function splitMultiline(s: string | undefined) {
  return (s ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).filter(Boolean);
}

/* ======================================================================= */
/*                                FRONT                                    */
/* ======================================================================= */

export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // y folgt PDF-Logik: nur die Gaps werden addiert (Baselines).
  let y = TOP_MM;

  const nameY = y;
  y += GAP_NAME_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_MM;

  // Abstand zu Kontakten
  y += CONTACT_BLOCK_SPACER_MM;

  // Kontakte (Zeilenabstand 3.5 mm)
  const contactLines: Array<{ text: string; y: number }> = [];
  if (phone) { contactLines.push({ text: `T ${phone}`, y }); y += GAP_CONTACT_MM; }
  if (email) { contactLines.push({ text: email,        y }); y += GAP_CONTACT_MM; }
  if (url)   { contactLines.push({ text: url,          y }); y += GAP_CONTACT_MM; }

  // Abstand zu Firma
  y += COMPANY_SPACER_MM;

  const companyLines = splitMultiline(company).map((text, i) => ({
    text,
    y: y + i * GAP_CONTACT_MM,
  }));

  return (
    <figure className="select-none">
      {/* 1 user unit == 1 mm */}
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block" }}
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

        {/* Textspalte – Frutiger Webfonts (aus global.css) */}
        <g
          fontFamily='"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
          fill="black"
          dominantBaseline="alphabetic"
        >
          {/* Name (Bold, 10pt) */}
          <text x={LEFT_MM} y={nameY} fontSize={`${NAME_PT}pt`} fontWeight={700}>
            {name}
          </text>

          {/* Rolle (Light Italic, 8pt) */}
          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              fontSize={`${ROLE_PT}pt`}
              fontStyle="italic"
              fontWeight={300}
              opacity={0.9}
            >
              {role}
            </text>
          )}

          {/* Kontakte */}
          {contactLines.map((l, idx) => (
            <text key={`c-${idx}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_PT}pt`} fontWeight={300}>
              {l.text}
            </text>
          ))}

          {/* Firma/Adresse */}
          {companyLines.map((l, idx) => (
            <text key={`a-${idx}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_PT}pt`} fontWeight={300}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      {/* kleine Bildunterschrift für Abstand im Layout */}
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
  );
}

/* ======================================================================= */
/*                                BACK                                     */
/* ======================================================================= */

export function BusinessCardBack(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  const orgName = splitMultiline(company)[0] ?? "";
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org: orgName,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel: company || undefined,
      }),
    [name, role, email, phone, url, company, orgName]
  );

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const data = await QRCode.toDataURL(vcard, {
          margin: 0,
          errorCorrectionLevel: "M",
          scale: 8,
        });
        if (!aborted) setQrDataUrl(data);
      } catch {
        if (!aborted) setQrDataUrl("");
      }
    })();
    return () => {
      aborted = true;
    };
  }, [vcard]);

  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block" }}
        aria-label="Business card back"
      >
        {/* Hintergrund */}
        <image
          href="/templates/omicron-back.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />

        {/* QR (vCard) */}
        {qrDataUrl ? (
          <image
            href={qrDataUrl}
            x={QR_X_MM}
            y={QR_Y_MM}
            width={QR_SIZE_MM}
            height={QR_SIZE_MM}
            preserveAspectRatio="none"
          />
        ) : (
          // Fallback (unsichtbarer Platzhalter)
          <rect x={QR_X_MM} y={QR_Y_MM} width={QR_SIZE_MM} height={QR_SIZE_MM} fill="transparent" />
        )}
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
