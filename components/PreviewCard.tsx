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
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie (mm) ---------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;
const TOP_MM = 24;

const GAP_NAME_MM = 4;
const GAP_CONTACT_MM = 3.5;
const CONTACT_BLOCK_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

const ptToMm = (pt: number) => (pt * 25.4) / 72;
const NAME_MM = ptToMm(10);
const ROLE_MM = ptToMm(8);
const BODY_MM = ptToMm(8);

/* QR-Defaults (leicht nach links/oben und kleiner) */
const QR_DEFAULT = {
  xMm: 48.8,
  yMm: 16.2,
  sizeMm: 29.8,
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
/* FRAME                                                                    */
/* ======================================================================= */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-xl border border-border/80 bg-card shadow-sm p-0">
      <figcaption className="px-2 py-1 text-sm font-medium text-muted-foreground">
        {title}
      </figcaption>
      {children}
    </figure>
  );
}

/* ======================================================================= */
/* FRONT                                                                    */
/* ======================================================================= */
export function BusinessCardFront(props: Props) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  let y = TOP_MM;
  const nameY = y;
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
    <Frame title="Card Front">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block", margin: 0 }}
      >
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />
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
              opacity={0.9}
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
    </Frame>
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
    <Frame title="Card Back">
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block", margin: 0 }}
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
    </Frame>
  );
}
