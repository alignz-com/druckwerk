"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type FrontLine = {
  key: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
};

function collectFrontLines({
  template,
  name,
  role = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
  linkedin = "",
}: {
  template: ResolvedTemplate;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  linkedin?: string;
}): FrontLine[] {
  const frame = template.config.front.textFrame;
  const previewCfg = template.config.front.preview ?? {};
  const fontScale = previewCfg.fontScale ?? DEFAULT_FONT_SCALE;
  const lineHeightScale = previewCfg.lineHeightScale ?? 1;
  const linesOut: FrontLine[] = [];
  const baseX = frame.xMm;
  const startY = frame.topMm + (previewCfg.baselineOffsetMm ?? 0);
  let cursorY = startY;

  const pushBlock = (lines: string[], style?: TemplateTextStyle) => {
    if (!style || lines.length === 0) return;
    const { fontSize, fontWeight, fontStyle } = svgFontAttributes(style, fontScale);
    const lineSpacing = style.lineGapMm * lineHeightScale;
    for (const line of lines) {
      linesOut.push({
        key: `line-${cursorY.toFixed(2)}-${line}`,
        text: line,
        x: baseX,
        y: cursorY,
        fontSize,
        fontWeight,
        fontStyle,
      });
      cursorY += lineSpacing;
    }
    if (style.spacingAfterMm) {
      cursorY += style.spacingAfterMm * lineHeightScale;
    }
  };

  pushBlock([name], frame.name);
  if (role) pushBlock([role], frame.role);

  const contactLines: string[] = [];
  const phoneLine = formatPhones(phone, mobile);
  if (phoneLine) contactLines.push(phoneLine);
  if (email) contactLines.push(email);
  if (url) contactLines.push(url);
  if (linkedin) contactLines.push(linkedin);
  pushBlock(contactLines, frame.contacts);

  const companyLines = (company ?? "").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  pushBlock(companyLines, frame.company);

  return linesOut;
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
  linkedin = "",
}: {
  template: ResolvedTemplate;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  linkedin?: string;
}) {
  const preparedLines = useMemo(
    () =>
      collectFrontLines({
        template,
        name,
        role,
        email,
        phone,
        mobile,
        company,
        url,
        linkedin,
      }),
    [template, name, role, email, phone, mobile, company, url, linkedin],
  );

  const signature = useMemo(
    () =>
      preparedLines
        .map((line) => `${line.text}|${line.y.toFixed(3)}|${line.fontSize.toFixed(3)}|${line.fontWeight}|${line.fontStyle}`)
        .join("||"),
    [preparedLines],
  );

  const [phase, setPhase] = useState<"init" | "show">("show");
  const previousSignature = useRef(signature);

  useEffect(() => {
    if (previousSignature.current === signature) return;
    previousSignature.current = signature;
    setPhase("init");
    const raf = requestAnimationFrame(() => setPhase("show"));
    return () => cancelAnimationFrame(raf);
  }, [signature]);

  const renderLines = (linesToRender: FrontLine[]) =>
    linesToRender.map((line) => (
      <text
        key={line.key}
        x={line.x}
        y={line.y}
        fontSize={line.fontSize}
        fontWeight={line.fontWeight}
        fontStyle={line.fontStyle}
        fill="#1f2937"
      >
        {line.text}
      </text>
    ));

  const opacityClass = phase === "init" ? "opacity-0" : "opacity-100";

  return (
    <g key={`active-${signature}`} className={`transition-opacity duration-200 ${opacityClass}`}>
      {renderLines(preparedLines)}
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
  linkedin?: string;
  template: ResolvedTemplate;
  /** Feintuning für QR nur in der Preview (mm) */
  qrOverride?: { xMm?: number; yMm?: number; sizeMm?: number };
};

/* ---------- Geometrie exakt wie im PDF (mm) ---------- */
const CARD_W = 85;
const CARD_H = 55;
const DEFAULT_PREVIEW_MAX_WIDTH = 960;
const DEFAULT_FONT_SCALE = 0.58;

function getTemplateAssetUrl(template: ResolvedTemplate, type: string) {
  return template.assets?.find((asset) => asset.type === type)?.publicUrl ?? null;
}

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
  linkedin?: string;
  addrLabel?: string;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    addressExtra?: string;
  };
}) {
  const { fullName, org, title, email, phone, mobile, url, linkedin, addrLabel, address } = o;

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
  if (url)    lines.push(`URL;TYPE=Work:${vEscape(url)}`);
  if (linkedin) lines.push(`URL;TYPE=LinkedIn:${vEscape(linkedin)}`);

  const structuredLabelLines: string[] = [];
  if (address?.street) structuredLabelLines.push(address.street);
  const postalCity = [address?.postalCode, address?.city].filter(Boolean).join(" " ).trim();
  if (postalCity) structuredLabelLines.push(postalCity);
  if (address?.country) structuredLabelLines.push(address.country);
  if (address?.addressExtra) structuredLabelLines.push(address.addressExtra);
  const resolvedLabel = structuredLabelLines.length > 0 ? structuredLabelLines.join("\n") : addrLabel ?? "";

  if (structuredLabelLines.length > 0 || addrLabel) {
    const streetLine = vEscape(address?.street ?? "");
    const cityLine = vEscape(address?.city ?? "");
    const postalLine = vEscape(address?.postalCode ?? "");
    const countryLine = vEscape(address?.country ?? "");
    const extraLine = vEscape(address?.addressExtra ?? "");
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(resolvedLabel)}":;${extraLine};${streetLine};${cityLine};;${postalLine};${countryLine}`);
  } else if (addrLabel) {
    const adr = ["", "", vEscape(addrLabel), "", "", "", ""].join(";");
    lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":${adr}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
/* ============================== FRONT ============================== */
export function BusinessCardFront({ template, name, role = "", email = "", phone = "", mobile = "", company = "", url = "", linkedin }: Props) {
  const previewCfg = template.config.front.preview ?? {};
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;
  const frontBackground = template.previewFrontPath || getTemplateAssetUrl(template, "PREVIEW_FRONT");
  return (
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", aspectRatio: `${CARD_W} / ${CARD_H}` }}
        aria-label="Business card front"
      >
        {frontBackground ? (
          <SmoothSvgImage
            src={frontBackground}
            x={0}
            y={0}
            width={CARD_W}
            height={CARD_H}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}

        <g className="[&>g]:opacity-100">
          <FrontTextOverlay
            template={template}
            name={name}
            role={role}
            email={email}
            phone={phone}
            mobile={mobile}
            company={company}
            url={url}
            linkedin={linkedin}
          />
        </g>
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
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        height="100%"
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
  linkedin,
  qrOverride,
}: Props) {
  const normalized = normalizeAddress(company);
  const { org, label, street: addrStreet, postalCode: addrPostal, city: addrCity, country: addrCountry, lines: addrLines } = normalized;
  const addrLabel = (label && label.trim()) ? label : (company || undefined);
  const addressExtra = addrLines && addrLines.length > 3 ? addrLines.slice(3).join(" ") : undefined;
  const previewCfg = template.config.front.preview ?? {};
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;
  const backBackground = template.previewBackPath || getTemplateAssetUrl(template, "PREVIEW_BACK");

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
        linkedin: linkedin || undefined,
        addrLabel,
        address: {
          street: addrStreet ?? undefined,
          postalCode: addrPostal ?? undefined,
          city: addrCity ?? undefined,
          country: addrCountry ?? undefined,
          addressExtra,
        },
      }),
    [name, role, email, phone, mobile, url, linkedin, org, addrLabel, addrStreet, addrPostal, addrCity, addrCountry, addressExtra],
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
  const previewQrOverride = template.config.back.preview?.qr;
  const qx = qrOverride?.xMm ?? previewQrOverride?.xMm ?? qrConfig?.xMm;
  const qy = qrOverride?.yMm ?? previewQrOverride?.yMm ?? qrConfig?.yMm;
  const qs = qrOverride?.sizeMm ?? previewQrOverride?.sizeMm ?? qrConfig?.sizeMm;

  return (
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", aspectRatio: `${CARD_W} / ${CARD_H}` }}
        aria-label="Business card back"
      >
        {backBackground ? (
          <SmoothSvgImage
            src={backBackground}
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
            linkedin={linkedin}
          />
        ) : null}
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
