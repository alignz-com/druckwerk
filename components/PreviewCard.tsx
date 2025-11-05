"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPhones } from "@/lib/formatPhones";
import { normalizeAddress } from "@/lib/normalizeAddress";
import QRCode from "qrcode";
import type { TemplateTextStyle } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";

function SmoothSvgImage({
  src,
  x,
  y,
  width,
  height,
  preserveAspectRatio = "xMidYMid meet",
  onError,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preserveAspectRatio?: string;
  onError?: () => void;
}) {
  const [displaySrc, setDisplaySrc] = useState(src); // what SVG currently shows
  const [entering, setEntering] = useState(false); // drives opacity transition

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
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio as any}
      className={`transition-opacity duration-300 ${entering ? "opacity-0" : "opacity-100"}`}
      onError={onError ? () => onError() : undefined}
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
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const SIGNED_URL_FALLBACK_TTL_MS = 60 * 60 * 1000;

const CARD_PIXEL_WIDTH = 1004;
const CARD_PIXEL_HEIGHT = 650;
const IMAGE_PIXEL_WIDTH = 1178;
const IMAGE_PIXEL_HEIGHT = 824;
const IMAGE_PADDING_PX = (IMAGE_PIXEL_WIDTH - CARD_PIXEL_WIDTH) / 2; // assuming symmetrical padding

const PX_TO_MM_X = CARD_W / CARD_PIXEL_WIDTH;
const PX_TO_MM_Y = CARD_H / CARD_PIXEL_HEIGHT;
const CANVAS_W = IMAGE_PIXEL_WIDTH * PX_TO_MM_X;
const CANVAS_H = IMAGE_PIXEL_HEIGHT * PX_TO_MM_Y;
const CANVAS_OFFSET_X = IMAGE_PADDING_PX * PX_TO_MM_X;
const CANVAS_OFFSET_Y = IMAGE_PADDING_PX * PX_TO_MM_Y;

type AssetState = {
  storageKey: string | null;
  url: string | null;
  expiresAt: number | null;
};

function normalizeExpiresAt(iso?: string) {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function useTemplateAssetSource(template: ResolvedTemplate, assetType: string, fallback?: string | null) {
  const fallbackUrl = fallback ?? null;
  const asset = useMemo(
    () => template.assets?.find((item) => item.type === assetType),
    [template.assets, assetType],
  );

  const [state, setState] = useState<AssetState>(() => ({
    storageKey: asset?.storageKey ?? null,
    url: asset?.publicUrl ?? fallbackUrl,
    expiresAt: normalizeExpiresAt(asset?.expiresAt),
  }));

  useEffect(() => {
    const nextState: AssetState = {
      storageKey: asset?.storageKey ?? null,
      url: asset?.publicUrl ?? fallbackUrl,
      expiresAt: normalizeExpiresAt(asset?.expiresAt),
    };

    setState((prev) =>
      prev.storageKey === nextState.storageKey && prev.url === nextState.url && prev.expiresAt === nextState.expiresAt
        ? prev
        : nextState,
    );
  }, [asset?.storageKey, asset?.publicUrl, asset?.expiresAt, fallbackUrl]);

  const refreshingRef = useRef(false);
  const { storageKey, url, expiresAt } = state;

  const refreshSignedUrl = useCallback(async () => {
    if (!storageKey || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const res = await fetch("/api/templates/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKeys: [storageKey] }),
      });

      if (!res.ok) {
        throw new Error(`Failed to refresh asset ${storageKey}: ${res.status}`);
      }

      const data = (await res.json()) as {
        urls?: Array<{ storageKey: string; url: string | null; expiresAt?: string }>;
      };
      const updated = data.urls?.find((entry) => entry.storageKey === storageKey);
      if (updated?.url) {
        const nextExpiresAt =
          normalizeExpiresAt(updated.expiresAt) ?? Date.now() + SIGNED_URL_FALLBACK_TTL_MS;
        setState({
          storageKey,
          url: updated.url,
          expiresAt: nextExpiresAt,
        });
      }
    } catch (error) {
      console.error("[preview] Failed to refresh template asset URL", error);
    } finally {
      refreshingRef.current = false;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !expiresAt) return;

    const refreshAt = expiresAt - SIGNED_URL_REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();
    if (delay <= 0) {
      refreshSignedUrl();
      return;
    }
    const timeout = window.setTimeout(refreshSignedUrl, delay);
    return () => window.clearTimeout(timeout);
  }, [storageKey, expiresAt, refreshSignedUrl]);

  const handleError = useCallback(() => {
    void refreshSignedUrl();
  }, [refreshSignedUrl]);

  return {
    url: url ?? fallbackUrl ?? null,
    onError: storageKey ? handleError : undefined,
  };
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
  const { url: frontBackground, onError: handleFrontAssetError } = useTemplateAssetSource(
    template,
    "PREVIEW_FRONT",
    template.previewFrontPath,
  );
  return (
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        aria-label="Business card front"
      >
        {frontBackground ? (
          <SmoothSvgImage
            src={frontBackground}
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            preserveAspectRatio="xMidYMid meet"
            onError={handleFrontAssetError}
          />
        ) : null}

        <g transform={`translate(${CANVAS_OFFSET_X}, ${CANVAS_OFFSET_Y})`} className="[&>g]:opacity-100">
          <rect
            x={0}
            y={0}
            width={CARD_W}
            height={CARD_H}
            fill="none"
            stroke="red"
            strokeWidth={0.4}
            vectorEffect="non-scaling-stroke"
          />
          <rect x={10} y={10} width={65} height={5} fill="#ff00ff" fillOpacity={0.35} />
          <rect
            x={10}
            y={10}
            width={65}
            height={5}
            fill="none"
            stroke="#ff00ff"
            strokeWidth={0.2}
            vectorEffect="non-scaling-stroke"
          />
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
  const { url: backBackground, onError: handleBackAssetError } = useTemplateAssetSource(
    template,
    "PREVIEW_BACK",
    template.previewBackPath,
  );

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
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        aria-label="Business card back"
      >
        {backBackground ? (
          <SmoothSvgImage
            src={backBackground}
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            preserveAspectRatio="xMidYMid meet"
            onError={handleBackAssetError}
          />
        ) : null}

        <g transform={`translate(${CANVAS_OFFSET_X}, ${CANVAS_OFFSET_Y})`}>
          <rect
            x={0}
            y={0}
            width={CARD_W}
            height={CARD_H}
            fill="none"
            stroke="red"
            strokeWidth={0.4}
            vectorEffect="non-scaling-stroke"
          />

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
        </g>
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
