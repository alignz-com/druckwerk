// components/PreviewCard.tsx
"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

// Vorlagen (mit Schnittmarken) – deine PNGs:
import frontBg from "@/public/templates/omicron-front.png";
import backBg  from "@/public/templates/omicron-back.png";

type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  frame?: boolean;       // <— neu: Außenrahmen rendern?
};

// mm → px bei einem Preview-Basismaß von 1000px Breite (einfach skalierbar)
const CARD_MM_W = 85.0;
const BASE_PX_W  = 1000;                 // Basisbreite der Vorschau in px
const pxPerMm    = BASE_PX_W / CARD_MM_W;

// Koordinaten wie im PDF:
const L_MM   = 24.4;   // linker Rand
const TOP_MM = 24.0;   // Abstand von oben zur 1. Grundlinie
const COL_W_MM = 85.0; // Spaltenbreite (wie im PDF genutzt)
const GAP_NAME_MM   = 4.0;
const GAP_BODY_MM   = 3.5;

const QR_SIZE_MM = 32.0;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

function mm(n: number) { return n * pxPerMm; }

function buildVCard3(opts: {
  fullName: string; org?: string; title?: string; email?: string; tel?: string; url?: string; addrLabel?: string;
}) {
  const esc = (s: string) => s.replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
  const L = [
    "BEGIN:VCARD","VERSION:3.0",
    `FN:${esc(opts.fullName)}`
  ];
  if (opts.org)   L.push(`ORG:${esc(opts.org)}`);
  if (opts.title) L.push(`TITLE:${esc(opts.title)}`);
  if (opts.tel)   L.push(`TEL;TYPE=WORK,VOICE:${esc(opts.tel)}`);
  if (opts.email) L.push(`EMAIL;TYPE=INTERNET,WORK:${esc(opts.email)}`);
  if (opts.url)   L.push(`URL:${esc(opts.url)}`);
  if (opts.addrLabel) L.push(`ADR;TYPE=WORK;LABEL="${esc(opts.addrLabel)}":;;;;;;`);
  L.push("END:VCARD");
  return L.join("\r\n");
}

export default function PreviewCard({
  name, role = "", email = "", phone = "", company = "", url = "", frame = true,
}: Props) {

  // vCard-QR wie im PDF
  const vcardDataUrl = useMemo(async () => {
    const org = (company || "").split(/\r?\n/)[0] || "";
    const v = buildVCard3({
      fullName: name, org, title: role || undefined,
      email: email || undefined, tel: phone || undefined, url: url || undefined,
      addrLabel: company || "",
    });
    return await QRCode.toDataURL(v, { width: 1024, margin: 0, errorCorrectionLevel: "M" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, role, email, phone, company, url]);

  return (
    <div className="font-frutiger">
      {/* FRONT */}
      <div
        className={`relative mx-auto ${frame ? "rounded-2xl border p-6 shadow-sm" : ""}`}
        style={{ width: BASE_PX_W }}
      >
        <img src={frontBg.src} alt="" className="w-full h-auto select-none pointer-events-none rounded-xl" />

        {/* Textblock absolut positioniert – Startpunkt L/TOP wie im PDF */}
        <div
          className="absolute"
          style={{ left: mm(L_MM), top: mm(TOP_MM) }}
        >
          {/* Name */}
          <div className="frutiger-bold" style={{ fontSize: mm(10) }}>{name}</div>

          {/* Rolle */}
          {role && (
            <div className="frutiger-light frutiger-italic" style={{ fontSize: mm(8), marginTop: mm(GAP_NAME_MM) }}>
              {role}
            </div>
          )}

          {/* Spacer */}
          <div style={{ marginTop: mm(3.25) }} />

          {/* Kontakte */}
          <div className="space-y-[1px] frutiger-light" style={{ fontSize: mm(8) }}>
            {phone && <div>{`T ${phone}`}</div>}
            {email && <div>{email}</div>}
            {url   && <div>{url}</div>}
          </div>

          {/* Abstand zu Adresse */}
          <div style={{ marginTop: mm(1.9) }} />

          {/* Adresse */}
          {company && (
            <div className="whitespace-pre-line frutiger-light" style={{ fontSize: mm(8) }}>
              {company}
            </div>
          )}
        </div>
      </div>

      {/* BACK */}
      <div
        className={`relative mx-auto mt-8 ${frame ? "rounded-2xl border p-6 shadow-sm" : ""}`}
        style={{ width: BASE_PX_W }}
      >
        <img src={backBg.src} alt="" className="w-full h-auto select-none pointer-events-none rounded-xl" />

        {/* QR exakt wie im PDF */}
        <div
          className="absolute"
          style={{ left: mm(QR_X_MM), bottom: mm(QR_Y_MM) }} // PNG unten links: in deinem Back-Template steht QR recht unten. Wenn es optisch zu hoch/tief sitzt, hier „bottom/top“ tauschen.
        >
          <img
            src={typeof vcardDataUrl === "string" ? vcardDataUrl : ""}
            alt="QR"
            style={{ width: mm(QR_SIZE_MM), height: mm(QR_SIZE_MM) }}
          />
        </div>
      </div>
    </div>
  );
}
