"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // multiline
  url?: string;
  /** Feintuning für QR nur in der Preview (mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie exakt wie im PDF (mm) ---------- */
const CARD_W = 85;
const CARD_H = 55;

const LEFT = 24.4;
const TOP = 20;

const GAP_NAME = 3;
const GAP_CONTACT = 2.5;
const CONTACT_SPACER = 2.2;
const COMPANY_SPACER = 1.3;

/* PDF-Fontgrößen in Punkt -> wir benutzen *die mm-Äquivalente als User-Units*.
   1pt = 1/72 inch; 1 inch = 25.4 mm -> pt to mm = 25.4/72 */
const ptToMm = (pt: number) => (pt * 25.4) / 72;

const FONT_SCALE_NAME = 0.7;
const FONT_SCALE_ROLE = 0.7;
const FONT_SCALE_BODY = 0.7;

const NAME = ptToMm(10) * FONT_SCALE_NAME;
const ROLE = ptToMm(8)  * FONT_SCALE_ROLE;
const BODY = ptToMm(8)  * FONT_SCALE_BODY;

/* QR — leicht kleiner und etwas nach links/oben für die weiße Box der Rückseite */
const QR_DEFAULT = {
  xMm: 44.8,     // PDF war ~52.8
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

function buildVCard3(o: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  tel?: string;
  url?: string;
  addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = o;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEscape(fullName)}`];
  if (org) lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url) lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/* ============================== FRONT ============================== */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // y-Positionen (Baseline) in mm – identisch zur PDF-Route
  let y = TOP;
  const nameY = y;
  y += GAP_NAME;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME;

  y += CONTACT_SPACER;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) {
    contacts.push({ text: `T ${phone}`, y });
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

  const addr = splitLines(company).map((text, i) => ({
    text,
    y: y + i * GAP_CONTACT,
  }));

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
