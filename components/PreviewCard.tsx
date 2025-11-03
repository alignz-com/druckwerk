"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { formatPhones } from "@/lib/formatPhones";
import { normalizeAddress } from "@/lib/normalizeAddress";
import QRCode from "qrcode";
import type { TemplateTextStyle } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";

function SmoothSvgImage({
  src,
  x, y, width, height,
  preserveAspectRatio = "xMidYMid meet",
}: {
  src: string;
  x: number; y: number; width: number; height: number;
  preserveAspectRatio?: string;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);      // what SVG currently shows
  const [entering, setEntering] = useState(false);        // drives opacity transition

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // swap to new source, then fade it in
      setDisplaySrc(src);
      setEntering(true);                // start at opacity-0
      requestAnimationFrame(() => {     // next tick -> opacity-100
        setEntering(false);
      });
    };
    img.onerror = () => {/* keep old image on error */};
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  // Old image stays visible until new is loaded (because displaySrc only changes after load).
  return (
    <image
      href={displaySrc}
      x={x} y={y} width={width} height={height}
      preserveAspectRatio={preserveAspectRatio as any}
      className={`transition-opacity duration-300 ${entering ? "opacity-0" : "opacity-100"}`}
    />
  );
}

function FrontTextOverlay({
  template,
  name,
  role = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
}: {
  template: ResolvedTemplate;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
}) {
  const frame = template.config.front.textFrame;
  const previewCfg = template.config.front.preview ?? {};
  const fontScale = previewCfg.fontScale ?? DEFAULT_FONT_SCALE;
  const texts: ReactElement[] = [];
  let cursor = frame.topMm;
  let index = 0;
  const baseX = frame.xMm;

  const pushBlock = (lines: string[], style?: TemplateTextStyle) => {
    if (!style || lines.length === 0) return;
    const { fontSize, fontWeight, fontStyle } = svgFontAttributes(style, fontScale);
    for (const line of lines) {
      texts.push(
        <text
          key={`line-${index}`}
          x={baseX}
          y={cursor}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
        >
          {line}
        </text>,
      );
      index += 1;
      cursor += style.lineGapMm;
    }
    if (style.spacingAfterMm) {
      cursor += style.spacingAfterMm;
    }
  };

  pushBlock([name], frame.name);
  if (role) pushBlock([role], frame.role);

  const contactLines: string[] = [];
  const phoneLine = formatPhones(phone, mobile);
  if (phoneLine) contactLines.push(phoneLine);
  if (email) contactLines.push(email);
  if (url) contactLines.push(url);
  pushBlock(contactLines, frame.contacts);

  const companyLines = (company ?? "").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  pushBlock(companyLines, frame.company);

  return (
    <g
      fontFamily={`"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`}
      fill="#111"
      dominantBaseline="alphabetic"
    >
      {texts}
    </g>
  );
}


export type Props = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string; // multiline
  url?: string;
  template: ResolvedTemplate;
  /** Feintuning für QR nur in der Preview (mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie exakt wie im PDF (mm) ---------- */
const CARD_W = 85;
const CARD_H = 55;
const DEFAULT_PREVIEW_MAX_WIDTH = 960;
const DEFAULT_FONT_SCALE = 0.65;

/* PDF-Fontgrößen in Punkt -> wir benutzen *die mm-Äquivalente als User-Units*.
   1pt = 1/72 inch; 1 inch = 25.4 mm -> pt to mm = 25.4/72 */
const ptToMm = (pt: number) => (pt * 25.4) / 72;

function svgFontAttributes(style: TemplateTextStyle, fontScale: number) {
  const fontSize = ptToMm(style.sizePt) * fontScale;
  let fontWeight = 400;
  let fontStyle = "normal" as "normal" | "italic";

  switch (style.font) {
    case "bold":
      fontWeight = 700;
      break;
    case "light":
      fontWeight = 300;
      break;
    case "lightItalic":
      fontWeight = 300;
      fontStyle = "italic";
      break;
  }

  return { fontSize, fontWeight, fontStyle };
}

/* ---------- kleine Helfer ---------- */
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
  if (addrLabel) {
  // ADR: PO Box ; Extended ; Street ; City ; Region ; Postal ; Country
  const adr = ["", "", vEscape(addrLabel), "", "", "", ""].join(";");
  lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":${adr}`);
}
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
/* ============================== FRONT ============================== */
export function BusinessCardFront({ template, name, role = "", email = "", phone = "", mobile = "", company = "", url = "" }: Props) {
  const previewCfg = template.config.front.preview ?? {};
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;
  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        style={{ maxWidth, height: "auto", display: "block", aspectRatio: `${CARD_W} / ${CARD_H}` }}
        aria-label="Business card front"
      >
        {template.previewFrontPath ? (
          <SmoothSvgImage
            src={template.previewFrontPath}
            x={0}
            y={0}
            width={CARD_W}
            height={CARD_H}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}

        <FrontTextOverlay
          template={template}
          name={name}
          role={role}
          email={email}
          phone={phone}
          mobile={mobile}
          company={company}
          url={url}
        />
      </svg>
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
  );
}

/* =============================== BACK =============================== */
/*export function BusinessCardBack(props: Props) {
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
          maxWidth: 960,
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
}*/


export function BusinessCardBack({
  template,
  name,
  role = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
  qrOverride,
}: Props) {
  const { org, label } = normalizeAddress(company);
  const addrLabel = (label && label.trim()) ? label : (company || undefined);
  const previewCfg = template.config.front.preview ?? {};
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;

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
        addrLabel,
      }),
    [name, role, email, phone, mobile, url, org, addrLabel],
  );

  const [qrData, setQrData] = useState<string>("");

  useEffect(() => {
    let stop = false;
    if (template.config.back.mode !== "qr") {
      setQrData("");
      return;
    }
    (async () => {
      try {
        const data = await QRCode.toDataURL(vcard, { margin: 0, errorCorrectionLevel: "M", scale: 8 });
        if (!stop) setQrData(data);
      } catch {
        if (!stop) setQrData("");
      }
    })();
    return () => {
      stop = true;
    };
  }, [vcard, template.config.back.mode]);

  const qrConfig = template.config.back.qr;
  const qx = qrOverride?.xMm ?? qrConfig?.xMm;
  const qy = qrOverride?.yMm ?? qrConfig?.yMm;
  const qs = qrOverride?.sizeMm ?? qrConfig?.sizeMm;

  return (
    <figure className="select-none">
      <svg
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        style={{ maxWidth, height: "auto", display: "block", aspectRatio: `${CARD_W} / ${CARD_H}` }}
        aria-label="Business card back"
      >
        {template.previewBackPath ? (
          <SmoothSvgImage
            src={template.previewBackPath}
            x={0}
            y={0}
            width={CARD_W}
            height={CARD_H}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}

        {template.config.back.mode === "qr" && qrData && qx !== undefined && qy !== undefined && qs !== undefined ? (
          <image href={qrData} x={qx} y={qy} width={qs} height={qs} preserveAspectRatio="none" />
        ) : null}

        {template.config.back.mode === "copyFront" ? (
          <FrontTextOverlay
            template={template}
            name={name}
            role={role}
            email={email}
            phone={phone}
            mobile={mobile}
            company={company}
            url={url}
          />
        ) : null}
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
