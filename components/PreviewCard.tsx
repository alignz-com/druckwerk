"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

/* =========================
   Öffentliche Props
========================= */
export type CardPreviewProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;   // Mehrzeilig
  url?: string;       // optional zusätzlich in vCard
  /** Rahmen um die Karte im Preview zeigen (Default true) */
  withFrame?: boolean;
  /** Nur Preview: QR-Feintuning in mm */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* =========================
   Geometrie in Millimetern
   (identisch zur PDF-Berechnung)
========================= */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

const LEFT_MM = 24.4;
const TOP_MM = 24;

const GAP_NAME_MM = 4;
const GAP_CONTACT_MM = 3.5;
const CONTACT_BLOCK_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

// pt → mm (PDF nutzt pt, SVG hier arbeitet im mm-ViewBox)
const ptToMm = (pt: number) => (pt * 25.4) / 72;
const NAME_MM = ptToMm(10); // 10 pt
const ROLE_MM = ptToMm(8);  // 8 pt
const BODY_MM = ptToMm(8);  // 8 pt

// QR-Defaults (Preview minimal enger als PDF; kannst auf PDF-Werte zurückstellen)
const QR_DEFAULT = {
  xMm: 50.6,     // PDF: 52.8
  yMm: 17.9,     // PDF: 18.85
  sizeMm: 29.5,  // PDF: 32
};

/* =========================
   Utils
========================= */
const splitLines = (s?: string) =>
  (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);

function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
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

/* =========================
   Rahmen-Wrapper (nur Preview)
========================= */
function Frame({
  title,
  children,
  withFrame = true,
}: {
  title: string;
  children: React.ReactNode;
  withFrame?: boolean;
}) {
  if (!withFrame) return <>{children}</>;

  return (
    <figure className="rounded-xl border border-border/80 bg-card shadow-sm p-4">
      <figcaption className="mb-3 text-sm font-medium text-muted-foreground">{title}</figcaption>
      <div className="rounded-lg border border-border bg-white p-3">
        {children}
      </div>
    </figure>
  );
}

/* =======================================================================
   FRONT
======================================================================= */
export function BusinessCardFront(props: CardPreviewProps) {
  const { name, role = "", email = "", phone = "", company = "", url = "", withFrame = true } = props;

  // Y-Akkumulator (Baseline-Positionen in mm)
  let y = TOP_MM;
  const nameY = y;
  y += GAP_NAME_MM;

  const roleY = role ? y : y;
  if (role) y += GAP_NAME_MM;

  y += CONTACT_BLOCK_SPACER_MM;

  const contacts: Array<{ text: string; y: number }> = [];
  if (phone) { contacts.push({ text: `T +${phone.replace(/^\+/, "")}`, y }); y += GAP_CONTACT_MM; }
  if (email) { contacts.push({ text: email, y }); y += GAP_CONTACT_MM; }
  if (url)   { contacts.push({ text: url,   y }); y += GAP_CONTACT_MM; }

  y += COMPANY_SPACER_MM;

  const addr = splitLines(company).map((text, i) => ({ text, y: y + i * GAP_CONTACT_MM }));

  return (
    <Frame title="Card Front" withFrame={withFrame}>
      <svg
        viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
        width="100%"
        style={{ maxWidth: 520, height: "auto", display: "block" }}
        aria-label="Business card front"
      >
        {/* Hintergrund als PNG (Druckvorlage) */}
        <image
          href="/templates/omicron-front.png"
          x={0}
          y={0}
          width={CARD_W_MM}
          height={CARD_H_MM}
          preserveAspectRatio="none"
        />

        {/* Text in mm (unitlose fontSize → ViewBox-User-Units = mm) */}
        <g
          fontFamily='"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
          fill="black"
          dominantBaseline="alphabetic"
        >
          <text x={LEFT_MM} y={nameY} fontSize={NAME_MM} fontWeight={700}>
            {name}
          </text>

          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              fontSize={ROLE_MM}
              fontStyle="italic"
              fontWeight={300}
              opacity={0.9}
            >
              {role}
            </text>
          )}

          {contacts.map((l, i) => (
            <text key={`c-${i}`} x={LEFT_MM} y={l.y} fontSize={BODY_MM} fontWeight={300}>
              {l.text}
            </text>
          ))}

          {addr.map((l, i) => (
            <text key={`a-${i}`} x={LEFT_MM} y={l.y} fontSize={BODY_MM} fontWeight={300}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
    </Frame>
  );
}

/* =======================================================================
   BACK
======================================================================= */
export function BusinessCardBack(props: CardPreviewProps) {
  const { name, role = "", email = "", phone = "", company = "", url = "", withFrame = true, qrOverride } = props;

  // vCard auf Basis der Form-Werte
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

  // QR erzeugen
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

  // QR-Position/Größe (mm)
  const qx = qrOverride?.xMm ?? QR_DEFAULT.xMm;
  const qy = qrOverride?.yMm ?? QR_DEFAULT.yMm;
  const qs = qrOverride?.sizeMm ?? QR_DEFAULT.sizeMm;

  return (
    <Frame title="Card Back" withFrame={withFrame}>
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
    </Frame>
  );
}
