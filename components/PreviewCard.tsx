"use client";

import * as React from "react";
import * as QRCode from "qrcode";

// --- Geometrie (identisch zu deiner PDF-Route) ---
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;

const L_MM = 24.4;     // linker Rand
const TOP_MM = 24;     // erste Grundlinie (von oben)
const COL_W_MM = 85;   // nur für Wraps (Preview: keine harten Wraps)

const GAP_NAME_ROLE_MM = 4;
const GAP_TO_CONTACTS_MM = 3.25;
const GAP_BODY_MM = 3.5;
const GAP_TO_COMPANY_MM = 1.9;

// QR (Rückseite) – identische Werte wie in /api/pdf
const QR_MM = 32;
const QR_X_MM = 52.8;
// In der PDF-Route ist y von unten gemessen – im SVG ist (0,0) oben links:
const QR_Y_TOP_MM = CARD_H_MM - (18.85 + QR_MM);

// mm ↔︎ pt
const mm2pt = (mm: number) => (mm * 72) / 25.4;
const W_PT = mm2pt(CARD_W_MM);
const H_PT = mm2pt(CARD_H_MM);

// vCard helper (identisch)
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
    `FN:${vEscape(fullName)}`,
  ];
  if (org) lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url) lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n"); // CRLF
}

type CommonProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
};

const FRONT_SRC = "/templates/omicron-front.png"; // <— bitte genau so (Bindestrich)
const BACK_SRC  = "/templates/omicron-back.png";

export function BusinessCardFront(props: CommonProps) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  // vertikale Position als „Baseline“ (wie PDF)
  let yPt = mm2pt(TOP_MM);
  const xPt = mm2pt(L_MM);

  // Fontgrößen in pt (identisch wie PDF)
  const fsNamePt = 10;
  const fsRolePt = 8;
  const fsBodyPt = 8;

  // Hilfsrenderer
  const Line = ({
    children,
    y,
    sizePt,
    weight = 300,
    italic = false,
  }: {
    children: React.ReactNode;
    y: number;
    sizePt: number;
    weight?: 300 | 700;
    italic?: boolean;
  }) => (
    <text
      x={xPt}
      y={y}
      fontFamily="Frutiger LT Pro"
      fontWeight={weight}
      fontStyle={italic ? "italic" : "normal"}
      fontSize={`${sizePt}pt`}
      dominantBaseline="alphabetic"
      textAnchor="start"
      fill="#111"
    >
      {children}
    </text>
  );

  const companyLines = company.replace(/\r\n/g, "\n").split("\n").filter(Boolean);

  return (
    <div className="w-full" style={{ maxWidth: 680 }}>
      <svg
        viewBox={`0 0 ${W_PT} ${H_PT}`}
        className="block w-full h-auto"
        aria-label="Card Front"
      >
        {/* Hintergrund */}
        <image href={FRONT_SRC} x={0} y={0} width={W_PT} height={H_PT} preserveAspectRatio="none" />

        {/* Name */}
        <Line y={yPt} sizePt={fsNamePt} weight={700}>{name}</Line>
        yPt += mm2pt(GAP_NAME_ROLE_MM);

        {/* Rolle */}
        {role && (
          <>
            <Line y={yPt} sizePt={fsRolePt} italic>{role}</Line>
            { (yPt += mm2pt(GAP_TO_CONTACTS_MM)) && null }
          </>
        )}

        {/* Kontakte */}
        {phone && (<Line y={(yPt += 0)} sizePt={fsBodyPt}>T {phone}</Line>)}
        {phone && (yPt += mm2pt(GAP_BODY_MM))}
        {email && (<Line y={(yPt += 0)} sizePt={fsBodyPt}>{email}</Line>)}
        {email && (yPt += mm2pt(GAP_BODY_MM))}
        {url && (<Line y={(yPt += 0)} sizePt={fsBodyPt}>{url}</Line>)}
        {url && (yPt += mm2pt(GAP_TO_COMPANY_MM))}

        {/* Firma/Adresse */}
        {companyLines.map((l, i) => {
          const y = i === 0 ? yPt : (yPt += mm2pt(GAP_BODY_MM));
          return <Line key={i} y={y} sizePt={fsBodyPt}>{l}</Line>;
        })}
      </svg>
    </div>
  );
}

export function BusinessCardBack(props: CommonProps) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;

  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    const org = (company || "").split(/\r?\n/)[0] || "";
    const vcard = buildVCard3({
      fullName: name,
      org,
      title: role || undefined,
      email: email || undefined,
      tel: phone || undefined,
      url: url || undefined,
      addrLabel: company || undefined,
    });
    QRCode.toDataURL(vcard, { width: 1024, margin: 0, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [name, role, email, phone, company, url]);

  const qrXpt = mm2pt(QR_X_MM);
  const qrYpt = mm2pt(QR_Y_TOP_MM);
  const qrSpt = mm2pt(QR_MM);

  return (
    <div className="w-full" style={{ maxWidth: 680 }}>
      <svg
        viewBox={`0 0 ${W_PT} ${H_PT}`}
        className="block w-full h-auto"
        aria-label="Card Back"
      >
        <image href={BACK_SRC} x={0} y={0} width={W_PT} height={H_PT} preserveAspectRatio="none" />
        {qrDataUrl && (
          <image href={qrDataUrl} x={qrXpt} y={qrYpt} width={qrSpt} height={qrSpt} />
        )}
      </svg>
    </div>
  );
}
