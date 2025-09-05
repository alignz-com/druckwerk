// components/PreviewCard.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as QRCode from "qrcode";

// --------- Geometrie (mm) – exakt wie im PDF ----------
const CARD_W_MM = 85;
const CARD_H_MM = 55;

// Text-Spalte wie in route.ts
const LEFT_MM = 24.4;         // linker Rand
const TOP_MM = 24;            // Abstand von oben zur ersten Grundlinie
const GAP_NAME_ROLE_MM = 4;   // Gap zwischen Name/Rolle
const GAP_BODY_MM = 3.5;      // Zeilenabstand Body
const SPACER_TO_CONTACT_MM = 3.25;
const SPACER_TO_COMPANY_MM = 1.9;

// Schriftgrößen (pt) aus deinem PDF – wir mappen sie 1:1
const NAME_PT = 10;
const ROLE_PT = 8;
const BODY_PT = 8;

// QR auf der Rückseite – identisch zu route.ts
const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_FROM_BOTTOM_MM = 18.85;

// Hintergrund-Grafiken (PNG/SVG), liegend im /public
const FRONT_BG = "/templates/omicron-front.png";
const BACK_BG  = "/templates/omicron-back.png";

// ---------- Utils ----------
const MM_TO_PX = 96 / 25.4; // CSS px @ 96dpi
const PT_TO_PX = (pt: number) => (pt / 72) * 96;

function mm(n: number) {
  return n * MM_TO_PX;
}

type Align = "left" | "center" | "right";

type FrontProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  url?: string;
  company?: string; // mehrzeilig
  // optional: override background paths
  frontBgSrc?: string;
};

type BackProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  url?: string;
  company?: string; // für ORG/Label
  backBgSrc?: string;
};

// Responsive Scale-Hook: skaliert die 85×55-mm-Karte in die Breite des Wrappers
function useFitScale(wrapperRef: React.RefObject<HTMLDivElement>, baseWidthPx: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function update() {
      const el = wrapperRef.current;
      if (!el) return;
      const w = el.clientWidth;
      // Kleine safety-Marge
      setScale(Math.max(0.1, Math.min(1, w / baseWidthPx)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [wrapperRef, baseWidthPx]);
  return scale;
}

// vCard-Helfer (wie in deiner API)
function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function buildVCard3(opts: { fullName: string; org?: string; title?: string; email?: string; tel?: string; url?: string; addrLabel?: string; }) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`
  ];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// Eine Zeile Text, mm-genau positioniert
function TextLine({
  xMm,
  yMm,
  sizePt,
  weight = 300,
  italic = false,
  children,
  align = "left",
}: {
  xMm: number;
  yMm: number; // von oben
  sizePt: number;
  weight?: 300 | 700;
  italic?: boolean;
  align?: Align;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: mm(xMm),
        top: mm(yMm),
        width: mm(CARD_W_MM - xMm - 5), // großzügige Breite für Zeilenumbruch
        fontFamily: '"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        fontSize: PT_TO_PX(sizePt),
        lineHeight: 1, // wir steuern Abstände über die yMm-Koordinaten
        textAlign: align,
        color: "oklch(0.145 0 0)", // wie dein --foreground (sehr dunkel)
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </div>
  );
}

// ---------- Vorderseite ----------
export function BusinessCardFront(props: FrontProps) {
  const {
    name,
    role = "",
    email = "",
    phone = "",
    url = "",
    company = "",
    frontBgSrc = FRONT_BG,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const baseWidthPx = mm(CARD_W_MM);
  const scale = useFitScale(wrapRef, baseWidthPx);

  // y-Akkumulator wie im PDF
  const y0 = TOP_MM;
  let y = y0;

  const lines = [] as Array<JSX.Element>;

  // Name (Bold, 10pt)
  lines.push(
    <TextLine key="name" xMm={LEFT_MM} yMm={y} sizePt={NAME_PT} weight={700}>
      {name}
    </TextLine>
  );
  y += GAP_NAME_ROLE_MM;

  // Rolle (LightItalic, 8pt)
  if (role) {
    lines.push(
      <TextLine key="role" xMm={LEFT_MM} yMm={y} sizePt={ROLE_PT} weight={300} italic>
        {role}
      </TextLine>
    );
    y += GAP_NAME_ROLE_MM;
  }

  // Spacer zu Kontakten
  y += SPACER_TO_CONTACT_MM;

  // Kontakte (Light, 8pt), jeweils 3.5mm Abstand
  if (phone) {
    lines.push(
      <TextLine key="phone" xMm={LEFT_MM} yMm={y} sizePt={BODY_PT} weight={300}>
        {`T ${phone}`}
      </TextLine>
    );
    y += GAP_BODY_MM;
  }
  if (email) {
    lines.push(
      <TextLine key="email" xMm={LEFT_MM} yMm={y} sizePt={BODY_PT} weight={300}>
        {email}
      </TextLine>
    );
    y += GAP_BODY_MM;
  }
  if (url) {
    lines.push(
      <TextLine key="url" xMm={LEFT_MM} yMm={y} sizePt={BODY_PT} weight={300}>
        {url}
      </TextLine>
    );
    y += GAP_BODY_MM;
  }

  // Spacer zu Firmenadresse
  y += SPACER_TO_COMPANY_MM;

  // Firmenadresse (Textarea → echte Zeilen), Light 8pt
  if (company) {
    const addrLines = company.replace(/\r\n/g, "\n").split("\n");
    addrLines.forEach((ln, i) => {
      lines.push(
        <TextLine key={`addr-${i}`} xMm={LEFT_MM} yMm={y} sizePt={BODY_PT} weight={300}>
          {ln}
        </TextLine>
      );
      y += GAP_BODY_MM;
    });
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: mm(CARD_W_MM),
          height: mm(CARD_H_MM),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        {/* Hintergrund exakt randlos */}
        <img
          src={frontBgSrc}
          alt="Front background"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
          }}
          draggable={false}
        />
        {/* Text-Lines */}
        {lines}
      </div>
    </div>
  );
}

// ---------- Rückseite (vCard-QR) ----------
export function BusinessCardBack(props: BackProps) {
  const {
    name,
    role = "",
    email = "",
    phone = "",
    url = "",
    company = "",
    backBgSrc = BACK_BG,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const baseWidthPx = mm(CARD_W_MM);
  const scale = useFitScale(wrapRef, baseWidthPx);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // vCard generieren wie in der API
  const orgName = (company || "").split(/\r?\n/)[0] || "";
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org: orgName || undefined,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel: company || undefined,
      }),
    [name, orgName, role, email, phone, url, company]
  );

  // QR generieren (1024 px → superscharf)
  useEffect(() => {
    let isCancelled = false;
    QRCode.toDataURL(vcard, {
      width: 1024,
      margin: 0,
      errorCorrectionLevel: "M",
    }).then((d) => {
      if (!isCancelled) setQrDataUrl(d);
    });
    return () => {
      isCancelled = true;
    };
  }, [vcard]);

  // QR-Position (y ist im PDF von unten – hier in "top" umrechnen)
  const qrWidthPx = mm(QR_SIZE_MM);
  const qrLeftPx = mm(QR_X_MM);
  const qrTopPx = mm(CARD_H_MM - (QR_Y_FROM_BOTTOM_MM + QR_SIZE_MM));

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: mm(CARD_W_MM),
          height: mm(CARD_H_MM),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        <img
          src={backBgSrc}
          alt="Back background"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
          }}
          draggable={false}
        />

        {/* QR */}
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="vCard QR"
            style={{
              position: "absolute",
              left: qrLeftPx,
              top: qrTopPx,
              width: qrWidthPx,
              height: qrWidthPx,
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
