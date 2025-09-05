"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  /** Optionales Feintuning für die QR-Position in mm (nur Preview) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie (mm) wie im PDF ---------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;
const TOP_MM = 24;

/** Baseline-Abstände (vor Korrektur) */
const GAP_NAME_MM = 4;
const GAP_CONTACT_MM = 3.5;
const CONTACT_BLOCK_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

/* ---------- PDF -> Screen Korrektur ---------- */
/** Browser rendert Fonts “optisch größer” als pdf-lib. */
const FONT_ADJ = 0.72;      // 0.70–0.76: kleiner/größer
const LH_ADJ = 0.88;        // 0.85–0.92: enger/luftiger

/* PDF-Schriftgrößen (pt) → mm */
const ptToMm = (pt: number) => (pt * 25.4) / 72;

/** Korrigierte Größen */
const NAME_MM = ptToMm(10) * FONT_ADJ; // 10pt
const ROLE_MM = ptToMm(8) * FONT_ADJ;  // 8pt
const BODY_MM = ptToMm(8) * FONT_ADJ;  // 8pt

/** Korrigierte Zeilenabstände */
const GAP_NAME_ADJ_MM = GAP_NAME_MM * LH_ADJ;
const GAP_CONTACT_ADJ_MM = GAP_CONTACT_MM * LH_ADJ;
const CONTACT_BLOCK_SPACER_ADJ_MM = CONTACT_BLOCK_SPACER_MM * LH_ADJ;
const COMPANY_SPACER_ADJ_MM = COMPANY_SPACER_MM * LH_ADJ;

/* ---------- QR-Defaults (optisch an Vorlage angeglichen) ---------- */
const QR_DEFAULT = {
  xMm: 49.2,   // etwas weiter links
  yMm: 17.2,   // etwas höher
  sizeMm: 26.8 // kleiner, passt in die weiße Fläche
};

/* ---------- vCard ---------- */
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

const splitLines = (s?: string) =>
  (s ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).filter(Boolean);

/* ======================================================================= */
/* FRONT                                                                    */
/* ======================================================================= */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // Grundlinien wie im PDF – mit angepassten Abständen
  let y = TOP_MM;                  // Baseline Name
  const nameY = y;
  y += GAP_NAME_ADJ_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_ADJ_MM;

  y += CONTACT_BLOCK_SPACER_ADJ_MM;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) { contacts.push({ text: `T +${phone.replace(/^\+?/, "")}`, y }); y += GAP_CONTACT_ADJ_MM; }
  if (email) { contacts.push({ text: email,                        y }); y += GAP_CONTACT_ADJ_MM; }
  if (url)   { contacts.push({ text: url,                          y }); y += GAP_CONTACT_ADJ_MM; }

  y += COMPANY_SPACER_ADJ_MM;

  const addr = splitLines(company).map((text, i) => ({ text, y: y + i * GAP_CONTACT_ADJ_MM }));

  return (
    <figure className="select-none">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
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
          {/* Text (mm) */}
          <g
            fontFamily='"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
            fill="black"
            dominantBaseline="alphabetic"
          >
            <text x={LEFT_MM} y={nameY} fontSize={`${NAME_MM}mm`} fontWeight={700}>
              {name}
            </text>

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

            {contacts.map((l, i) => (
              <text key={`c-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_MM}mm`} fontWeight={300}>
                {l.text}
              </text>
            ))}

            {addr.map((l, i) => (
              <text key={`a-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_MM}mm`} fontWeight={300}>
                {l.text}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
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
    return () => { stop = true; };
  }, [vcard]);

  const qx = qrOverride?.xMm ?? QR_DEFAULT.xMm;
  const qy = qrOverride?.yMm ?? QR_DEFAULT.yMm;
  const qs = qrOverride?.sizeMm ?? QR_DEFAULT.sizeMm;

  return (
    <figure className="select-none">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <svg
          viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
          width="100%"
          style={{ maxWidth: 520, height: "auto", display: "block" }}
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
      </div>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
