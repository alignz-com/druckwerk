"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";

/** ===== Omicron-Geometrie (mm/pt) – wie in der PDF-Route ===== */
const OMI = {
  // Textspalte (Front)
  TEXT_LEFT_MM: 24.4,        // L
  TEXT_TOP_MM: 24,           // TOP (erste Grundlinie von oben)
  TEXT_COL_WIDTH_MM: 85,     // W
  NAME_SIZE_PT: 10,
  ROLE_SIZE_PT: 8,
  BODY_SIZE_PT: 8,
  GAP_NAME_MM: 4,            // Zeilenabstand Name/Rolle
  GAP_AFTER_ROLE_MM: 3.25,   // Abstand Rolle -> Kontakte
  GAP_BODY_MM: 3.5,          // Zeilenabstand im Body
  GAP_BEFORE_COMPANY_MM: 1.9,// Abstand Kontakte -> Firma/Adresse

  // QR (Back)
  QR_SIZE_MM: 32,
  QR_X_MM: 52.8,
  QR_Y_MM: 18.85,            // von unten (PDF); wir nutzen unten in CSS
} as const;

/** ===== Nur für PREVIEW (CSS): mm -> px bei 96 dpi ===== */
const mm2px = (mm: number) => (mm * 96) / 25.4;

/** ===== Feintuning NUR für die Preview (PDF bleibt unberührt!) ===== */
const PREVIEW_TUNE = {
  TEXT_DX_MM: -1.2,   // negativ = weiter nach links
  TEXT_DY_MM:  0.8,   // positiv = weiter nach oben
  QR_DX_MM:   -1.5,
  QR_DY_MM:    1.2,
};

/** vCard helpers (wie in der PDF-Route) */
function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function buildVCard3(opts: {
  fullName: string; org?: string; title?: string; email?: string; tel?: string; url?: string; addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`,
    org   ? `ORG:${vEscape(org)}` : "",
    title ? `TITLE:${vEscape(title)}` : "",
    tel   ? `TEL;TYPE=WORK,VOICE:${vEscape(tel)}` : "",
    email ? `EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}` : "",
    url   ? `URL:${vEscape(url)}` : "",
    addrLabel ? `ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
};

export default function PreviewCard({
  name, role = "", email = "", phone = "", company = "", url = "",
}: Props) {
  const [qrSrc, setQrSrc] = useState<string>("");

  // vCard-QR wie in der PDF
  useEffect(() => {
    const orgName = (company || "").split(/\r?\n/)[0] || "";
    const vcard = buildVCard3({
      fullName: name,
      org: orgName,
      title: role || undefined,
      email: email || undefined,
      tel: phone || undefined,
      url: url || undefined,
      addrLabel: company || undefined,
    });
    QRCode.toDataURL(vcard, { width: 1024, margin: 0, errorCorrectionLevel: "M" })
      .then(setQrSrc)
      .catch(() => setQrSrc(""));
  }, [name, role, email, phone, company, url]);

  // Maße/Positionen für Preview (px)
  const textLeft = useMemo(
    () => mm2px(OMI.TEXT_LEFT_MM + PREVIEW_TUNE.TEXT_DX_MM), []
  );
  const textTop = useMemo(
    () => mm2px(OMI.TEXT_TOP_MM + PREVIEW_TUNE.TEXT_DY_MM), []
  );
  const colWidth = useMemo(() => mm2px(OMI.TEXT_COL_WIDTH_MM), []);
  const qrSizePx = useMemo(() => mm2px(OMI.QR_SIZE_MM), []);
  const qrX = useMemo(() => mm2px(OMI.QR_X_MM + PREVIEW_TUNE.QR_DX_MM), []);
  const qrY = useMemo(() => mm2px(OMI.QR_Y_MM + PREVIEW_TUNE.QR_DY_MM), []);

  const companyLines = useMemo(
    () => (company || "").replace(/\r\n/g, "\n").split("\n"),
    [company]
  );

  return (
    <div className="relative mx-auto aspect-[210/297] w-[520px] rounded-2xl border bg-white p-8">
      {/* FRONT */}
      <div className="relative h-1/2 w-full overflow-hidden rounded-lg border">
        <Image
          src="/templates/omicron-front.png"  // <— PNG/JPG Export deiner Vorderseite
          alt=""
          fill
          className="object-contain"
          priority
        />
        {/* Textblock absolut */}
        <div
          className="absolute"
          style={{ left: textLeft, top: textTop, width: colWidth }}
        >
          <div style={{ fontFamily: "FrutigerLTPro-Bold, system-ui", fontSize: OMI.NAME_SIZE_PT }}>
            {name}
          </div>

          {role && (
            <div
              style={{
                fontFamily: "FrutigerLTPro-LightItalic, system-ui",
                fontSize: OMI.ROLE_SIZE_PT,
                marginTop: `${OMI.GAP_NAME_MM}mm`,
              }}
            >
              {role}
            </div>
          )}

          <div style={{ marginTop: `${OMI.GAP_AFTER_ROLE_MM}mm` }} />

          <div style={{ fontFamily: "FrutigerLTPro-Light, system-ui", fontSize: OMI.BODY_SIZE_PT, lineHeight: 1.2 }}>
            {phone && <div style={{ marginBottom: `${OMI.GAP_BODY_MM}mm` }}>T {phone}</div>}
            {email && <div style={{ marginBottom: `${OMI.GAP_BODY_MM}mm` }}>{email}</div>}
            {url   && <div style={{ marginBottom: `${OMI.GAP_BODY_MM}mm` }}>{url}</div>}

            <div style={{ marginTop: `${OMI.GAP_BEFORE_COMPANY_MM}mm` }} />
            {companyLines.map((l, i) => (
              <div key={i} style={{ marginBottom: `${OMI.GAP_BODY_MM}mm` }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BACK */}
      <div className="relative mt-8 h-1/2 w-full overflow-hidden rounded-lg border">
        <Image
          src="/templates/omicron-back.png"   // <— PNG/JPG Export deiner Rückseite
          alt=""
          fill
          className="object-contain"
          priority
        />
        {qrSrc && (
          <img
            src={qrSrc}
            alt="QR"
            className="absolute"
            style={{
              left: qrX,
              bottom: qrY,              // wie PDF: y von unten
              width: qrSizePx,
              height: qrSizePx,
            }}
          />
        )}
      </div>
    </div>
  );
}
