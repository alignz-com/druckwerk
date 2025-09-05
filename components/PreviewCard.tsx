"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhones } from "@/lib/formatPhones";
import { normalizeAddress } from "@/lib/normalizeAddress";
import QRCode from "qrcode";

export type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string; // multiline
  url?: string;
  /** Feintuning für QR nur in der Preview (mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie exakt wie im PDF (mm) ---------- */
const CARD_W = 85;
const CARD_H = 55;

const LEFT = 22;
const TOP = 19;

const GAP_NAME = 3;
const GAP_CONTACT = 2.5;
const CONTACT_SPACER = 2.5;
const COMPANY_SPACER = 2.5;

/* PDF-Fontgrößen in Punkt -> wir benutzen *die mm-Äquivalente als User-Units*.
   1pt = 1/72 inch; 1 inch = 25.4 mm -> pt to mm = 25.4/72 */
const ptToMm = (pt: number) => (pt * 25.4) / 72;

const FONT_SCALE_NAME = 0.75;
const FONT_SCALE_ROLE = 0.75;
const FONT_SCALE_BODY = 0.75;

const NAME = ptToMm(10) * FONT_SCALE_NAME;
const ROLE = ptToMm(8)  * FONT_SCALE_ROLE;
const BODY = ptToMm(8)  * FONT_SCALE_BODY;

/* QR — leicht kleiner und etwas nach links/oben für die weiße Box der Rückseite */
const QR_DEFAULT = {
  xMm: 45,     // PDF war ~52.8
  yMm: 15,     // PDF war ~18.85
  sizeMm: 25,  // PDF war 32
};

/* ---------- kleine Helfer ---------- */
const splitLines = (s?: string) =>
  (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);

function vEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function splitName(full: string) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { given: "", family: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { given: parts[0], family: "" };
  const family = parts.pop() as string;  // Nachname = letztes Wort
  const given = parts.join(" ");         // Vorname(n)
  return { given, family };
}
function buildVCard3(o: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  phone?: string;   // Festnetz/Work
  mobile?: string;  // Mobile
  url?: string;
  addrLabel?: string;
}) {
  const { fullName, org, title, email, phone, mobile, url, addrLabel } = o;

  // N + FN zuerst!
  const { given, family } = splitName(fullName);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEscape(family)};${vEscape(given)};;;`,
    `FN:${vEscape(fullName)}`,
  ];

  if (org)    lines.push(`ORG:${vEscape(org)}`);
  if (title)  lines.push(`TITLE:${vEscape(title)}`);
  if (phone)  lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(phone)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,MOBILE:${vEscape(mobile)}`);
  if (email)  lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)    lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
/* ============================== FRONT ============================== */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", mobile = "", company = "", url = "" } = props;

  // y-Positionen (Baseline) in mm – identisch zur PDF-Route
  let y = TOP;
  const nameY = y;
  y += GAP_NAME;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME;

  y += CONTACT_SPACER;

  const contacts: Array<{ text: string; y: number }> = [];
  const phoneLine = formatPhones(phone, mobile); // <— mobile kommt aus deinem State
  if (phoneLine) {
    contacts.push({ text: phoneLine, y });
    y += GAP_CONTACT;
  }
  if (email) {
    contacts.push({ text: email, y });
    y += GAP_CONTACT;
  }
  if (url) {
    contacts.push({ text: url, y });
    y += GAP_CONTACT;
  }

  y += COMPANY_SPACER;

  const addr = (company ?? "")
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map((text, i) => ({ text, y: y + i * GAP_CONTACT }));

  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        style={{
          maxWidth: 560,
          height: "auto",
          display: "block",
          aspectRatio: `${CARD_W} / ${CARD_H}`,
        }}
        aria-label="Business card front"
      >
        {/* Hintergrund */}
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W}
          height={CARD_H}
          preserveAspectRatio="xMidYMid meet"
        />
        {/* Text – ACHTUNG: fontSize ohne Einheit (User-Units == mm) */}
        <g
          fontFamily={`"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`}
          fill="#111"
          dominantBaseline="alphabetic"
        >
          <text x={LEFT} y={nameY} fontSize={NAME} fontWeight={700}>
            {name}
          </text>

          {role && (
            <text x={LEFT} y={roleY} fontSize={ROLE} fontWeight={300} fontStyle="italic" opacity={0.95}>
              {role}
            </text>
          )}

          {contacts.map((l, i) => (
            <text key={`c-${i}`} x={LEFT} y={l.y} fontSize={BODY} fontWeight={300}>
              {l.text}
            </text>
          ))}

          {addr.map((l, i) => (
            <text key={`a-${i}`} x={LEFT} y={l.y} fontSize={BODY} fontWeight={300}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
  );
}

/* =============================== BACK =============================== */
export function BusinessCardBack(props: Props) {
  const { name, role = "", email = "", phone = "", mobile = "", company = "", url = "", qrOverride } = props;
  
  // nachher
  const { org, label } = normalizeAddress(company);
  
  // Fallback wie in der PDF-Route: wenn label leer, nimm company
  const addrLabel = (label && label.trim()) ? label : (company || undefined);
  
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org,
        title: role || undefined,
        email: email || undefined,
        phone: phone || undefined,
        mobile: mobile || undefined,
        url: url || undefined,
        addrLabel, // <- jetzt sicher befüllt
      }),
    [name, role, email, phone, mobile, url, org, addrLabel] // <- addrLabel in deps!
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
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        style={{
          maxWidth: 560,
          height: "auto",
          display: "block",
          aspectRatio: `${CARD_W} / ${CARD_H}`,
        }}
        aria-label="Business card back"
      >
        <image
          href="/templates/omicron-back.png"
          x={0}
          y={0}
          width={CARD_W}
          height={CARD_H}
          preserveAspectRatio="xMidYMid meet"
        />
        {qrData && <image href={qrData} x={qx} y={qy} width={qs} height={qs} preserveAspectRatio="none" />}
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
