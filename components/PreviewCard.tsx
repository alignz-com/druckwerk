"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
  url?: string;
  /** Optionales Feintuning nur für die Preview (in mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* -------------------- Geometrie (mm) exakt wie PDF -------------------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;          // Spalten-Start links
const TOP_MM = 24;             // Abstand von oben zur ersten Grundlinie

const GAP_NAME_MM = 4;         // Zeilenabstand Name/Rolle
const GAP_CONTACT_MM = 3.5;    // Zeilenabstand im Body
const CONTACT_BLOCK_SPACER_MM = 3.25; // Abstand Rolle → Kontakte
const COMPANY_SPACER_MM = 1.9; // Abstand Kontakte → Firma/Adresse

/* PDF-Schriftgrößen (pt) -> mm */
const ptToMm = (pt: number) => (pt * 25.4) / 72;
const NAME_MM = ptToMm(10); // 10 pt
const ROLE_MM = ptToMm(8);  // 8 pt
const BODY_MM = ptToMm(8);  // 8 pt

/* QR-Position wie im PDF (Back) */
const QR_PDF = {
  xMm: 52.8,
  yMm: 18.85,
  sizeMm: 32,
};

/* -------------------- vCard helpers -------------------- */
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
  return lines.join("\r\n"); // CRLF
}
const splitLines = (s?: string) =>
  (s ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).filter(Boolean);

/* =======================================================================
   FRONT
   ======================================================================= */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // Baselines strikt wie im PDF, top→down
  let y = TOP_MM;

  const nameY = y; // Name
  y += GAP_NAME_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_MM;

  y += CONTACT_BLOCK_SPACER_MM;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) { contacts.push({ text: `T ${phone}`, y }); y += GAP_CONTACT_MM; }
  if (email) { contacts.push({ text: email,        y }); y += GAP_CONTACT_MM; }
  if (url)   { contacts.push({ text: url,          y }); y += GAP_CONTACT_MM; }

  y += COMPANY_SPACER_MM;

  const addr = splitLines(company).map((text, i) => ({ text, y: y + i * GAP_CONTACT_MM }));

  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block" }}
        aria-label="Business card front"
      >
        {/* Hintergrund (PNG) */}
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />

        {/* Text (mm) */}
        <g
          fontFamily='"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
          fill="black"
          dominantBaseline="alphabetic"
        >
          {/* Name */}
          <text x={LEFT_MM} y={nameY} fontSize={`${NAME_MM}mm`} fontWeight={700}>
            {name}
          </text>

          {/* Rolle (light italic) */}
          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              fontSize={`${ROLE_MM}mm`}
              fontStyle="italic"
              fontWeight={300}
            >
              {role}
            </text>
          )}

          {/* Kontakte */}
          {contacts.map((l, i) => (
            <text key={`c-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_MM}mm`} fontWeight={300}>
              {l.text}
            </text>
          ))}

          {/* Adresse */}
          {addr.map((l, i) => (
            <text key={`a-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_MM}mm`} fontWeight={300}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
  );
}

/* =======================================================================
   BACK
   ======================================================================= */
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
          scale: 8, // ausreichend hoch, damit es im SVG sauber skaliert
        });
        if (!stop) setQrData(data);
      } catch {
        if (!stop) setQrData("");
      }
    })();
    return () => { stop = true; };
  }, [vcard]);

  const qx = qrOverride?.xMm ?? QR_PDF.xMm;
  const qy = qrOverride?.yMm ?? QR_PDF.yMm;
  const qs = qrOverride?.sizeMm ?? QR_PDF.sizeMm;

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
        {qrData && (
          <image
            href={qrData}
            x={qx}
            y={qy}
            width={qs}
            height={qs}
            preserveAspectRatio="none"
          />
        )}
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
