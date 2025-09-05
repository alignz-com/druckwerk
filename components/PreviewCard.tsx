"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

/** Shared props */
export type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // multiline
  url?: string;
  /** Fine-tune QR just for the preview (mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* =================== Geometry in mm (like PDF) =================== */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;
const TOP_MM = 24;

const GAP_NAME_MM = 4;
const GAP_CONTACT_MM = 3.5;
const CONTACT_BLOCK_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

/* ---- Typography: use px for font-size (stable across browsers) ----
   1 pt = 96/72 px = 1.333333… px  */
const ptToPx = (pt: number) => (pt * 96) / 72;
const NAME_PX = ptToPx(10); // 10 pt -> 13.333 px
const ROLE_PX = ptToPx(8);  //  8 pt -> 10.666 px
const BODY_PX = ptToPx(8);  //  8 pt -> 10.666 px

/* ---- QR defaults (slightly smaller & shifted left/up for the white box) ---- */
const QR_DEFAULT = {
  xMm: 49.8,    // was ~52.8 in PDF
  yMm: 18.3,    // was ~18.85
  sizeMm: 27.6, // was 32
};

/* Helpers */
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

  // y positions in mm (top → bottom), identical to the PDF logic
  let y = TOP_MM;
  const nameY = y;
  y += GAP_NAME_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_MM;

  y += CONTACT_BLOCK_SPACER_MM;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) {
    contacts.push({ text: `T ${phone}`, y });
    y += GAP_CONTACT_MM;
  }
  if (email) {
    contacts.push({ text: email, y });
    y += GAP_CONTACT_MM;
  }
  if (url) {
    contacts.push({ text: url, y });
    y += GAP_CONTACT_MM;
  }

  y += COMPANY_SPACER_MM;

  const addr = splitLines(company).map((text, i) => ({
    text,
    y: y + i * GAP_CONTACT_MM,
  }));

  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 560, height: "auto", display: "block" }}
        aria-label="Business card front"
      >
        {/* Background */}
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />
        {/* Text (positions in mm; font-size in px) */}
        <g
          fontFamily={`"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`}
          fill="#111"
          dominantBaseline="alphabetic"
        >
          <text x={LEFT_MM} y={nameY} fontSize={`${NAME_PX}px`} fontWeight={700}>
            {name}
          </text>

          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              fontSize={`${ROLE_PX}px`}
              fontStyle="italic"
              fontWeight={300}
              opacity={0.95}
            >
              {role}
            </text>
          )}

          {contacts.map((l, i) => (
            <text key={`c-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_PX}px`} fontWeight={300}>
              {l.text}
            </text>
          ))}

          {addr.map((l, i) => (
            <text key={`a-${i}`} x={LEFT_MM} y={l.y} fontSize={`${BODY_PX}px`} fontWeight={300}>
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
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 560, height: "auto", display: "block" }}
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
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
