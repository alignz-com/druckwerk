"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { formatPhones } from "@/lib/formatPhones";
import { normalizeAddress } from "@/lib/normalizeAddress";
import QRCode from "qrcode";
import type { TemplateTextStyle } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";
import { DEFAULT_TEMPLATE_DESIGN } from "@/lib/template-design";
import type { DesignElement, TextElement, StackElement, RectElement, QrElement } from "@/lib/template-design";

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

type RenderContext = Record<string, unknown>;

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

function resolveField(context: RenderContext, path: string) {
  const parts = path.split(".");
  let current: any = context;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function evaluateVisibility(visibility: NonNullable<TextElement["visibility"]>, context: RenderContext) {
  const value = resolveField(context, visibility.binding);
  if (visibility.equals !== undefined) {
    return value === visibility.equals;
  }
  if (visibility.notEmpty) {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }
  return Boolean(value);
}

function evaluateTextContent(element: TextElement, context: RenderContext) {
  const parts = element.parts ?? (element.binding ? [{ type: "binding" as const, field: element.binding }] : []);
  if (parts.length === 0) return "";

  const resolved = parts.map((part) => {
    if (part.type === "literal") {
      return part.value;
    }
    const value = resolveField(context, part.field);
    if (value == null || value === "") {
      return part.fallback ?? "";
    }
    if (Array.isArray(value)) return value.join("\n");
    return String(value);
  });

  const joined = resolved.join("");
  if (joined.trim().length === 0) {
    return "";
  }
  return joined;
}

function getLineHeightMm(font: TextElement["font"]) {
  if (font.lineHeightMm) return font.lineHeightMm;
  const sizeMm = ptToMm(font.sizePt);
  const multiplier = font.lineHeight ?? 1.2;
  return sizeMm * multiplier;
}

type PreparedText = {
  element: TextElement;
  content: string;
  fontSizeMm: number;
  lineHeightMm: number;
};

function prepareTextElement(element: TextElement, context: RenderContext): PreparedText | null {
  if (element.visibility && !evaluateVisibility(element.visibility, context)) {
    return null;
  }
  const content = evaluateTextContent(element, context);
  if (!content) return null;
  const fontSizeMm = ptToMm(element.font.sizePt);
  const lineHeightMm = getLineHeightMm(element.font);
  return {
    element,
    content,
    fontSizeMm,
    lineHeightMm,
  };
}

function renderRectElement(rect: RectElement, context: RenderContext, key: string) {
  if (rect.visibility && !evaluateVisibility(rect.visibility, context)) {
    return null;
  }
  return (
    <rect
      key={key}
      x={rect.xMm}
      y={rect.yMm}
      width={rect.widthMm}
      height={rect.heightMm}
      fill={rect.fill ?? "none"}
      opacity={rect.opacity}
      stroke={rect.stroke}
      strokeWidth={rect.strokeWidthMm}
      rx={rect.radiusMm}
      ry={rect.radiusMm}
    />
  );
}

function renderTextElement(prepared: PreparedText, context: RenderContext, key: string, offsetX = 0, offsetY = 0) {
  const { element, fontSizeMm, content } = prepared;
  return (
    <text
      key={key}
      x={offsetX + (element.xMm ?? 0)}
      y={offsetY + (element.yMm ?? 0)}
      fontSize={fontSizeMm}
      fontWeight={element.font.weight ?? 400}
      fill={element.font.color ?? "#1f2937"}
      dominantBaseline={element.font.baseline ?? "hanging"}
      letterSpacing={element.font.letterSpacing}
      textAnchor={element.textAnchor}
    >
      {content}
    </text>
  );
}

function renderQrElement(element: QrElement, context: RenderContext, key: string) {
  if (element.visibility && !evaluateVisibility(element.visibility, context)) {
    return null;
  }
  const data = resolveField(context, element.dataBinding);
  if (typeof data !== "string" || data.length === 0) {
    return null;
  }
  return (
    <image
      key={key}
      href={data}
      x={element.xMm}
      y={element.yMm}
      width={element.sizeMm}
      height={element.sizeMm}
      preserveAspectRatio="none"
    />
  );
}

type StackPreparedChild = {
  kind: "text";
  prepared: PreparedText;
} | {
  kind: "rect";
  element: RectElement;
};

function renderStackElement(element: StackElement, context: RenderContext, key: string): ReactNode | null {
  if (element.visibility && element.visibility.binding) {
    if (!evaluateVisibility(element.visibility, context)) return null;
  }

  const preparedItems: Array<StackPreparedChild> = [];
  for (let index = 0; index < element.items.length; index += 1) {
    const child = element.items[index];
    if (child.type === "text") {
      const prepared = prepareTextElement(child, context);
      if (prepared) {
        preparedItems.push({ kind: "text", prepared });
      }
    } else if (child.type === "rect") {
      if (!child.visibility || evaluateVisibility(child.visibility, context)) {
        preparedItems.push({ kind: "rect", element: child });
      }
    }
  }

  if (preparedItems.length === 0) return null;

  const gap = element.gapMm ?? 0;
  let cursorY = 0;
  const nodes = preparedItems.map((item, idx) => {
    if (item.kind === "text") {
      const rendered = renderTextElement(
        item.prepared,
        context,
        `${key}-stack-${idx}`,
        0,
        cursorY,
      );
      cursorY += item.prepared.lineHeightMm + (idx < preparedItems.length - 1 ? gap : 0);
      return rendered;
    }
    if (item.kind === "rect") {
      const rect = item.element;
      const yOffset = cursorY + (rect.yMm ?? 0);
      const node = (
        <rect
          key={`${key}-stack-${idx}`}
          x={rect.xMm}
          y={yOffset}
          width={rect.widthMm}
          height={rect.heightMm}
          fill={rect.fill ?? "none"}
          opacity={rect.opacity}
          stroke={rect.stroke}
          strokeWidth={rect.strokeWidthMm}
          rx={rect.radiusMm}
          ry={rect.radiusMm}
        />
      );
      cursorY = yOffset + rect.heightMm + (idx < preparedItems.length - 1 ? gap : 0);
      return node;
    }
    return null;
  }).filter(Boolean) as ReactNode[];

  return (
    <g key={key} transform={`translate(${element.xMm}, ${element.yMm})`}>
      {nodes}
    </g>
  );
}

function renderDesignElements(elements: DesignElement[] | undefined, context: RenderContext, keyPrefix = "el"): ReactNode[] {
  if (!elements?.length) return [];
  const nodes: ReactNode[] = [];

  elements.forEach((element, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (element.type) {
      case "rect": {
        const rectNode = renderRectElement(element, context, key);
        if (rectNode) nodes.push(rectNode);
        break;
      }
      case "text": {
        const prepared = prepareTextElement(element, context);
        if (prepared) {
          nodes.push(renderTextElement(prepared, context, key));
        }
        break;
      }
      case "stack": {
        const stackNode = renderStackElement(element, context, key);
        if (stackNode) nodes.push(stackNode);
        break;
      }
      case "qr": {
        const qrNode = renderQrElement(element, context, key);
        if (qrNode) nodes.push(qrNode);
        break;
      }
      default:
        break;
    }
  });

  return nodes;
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
  const design = template.design ?? DEFAULT_TEMPLATE_DESIGN;
  const frontContext = useMemo(
    () => ({
      name,
      role,
      email,
      phone,
      mobile,
      company,
      url,
      linkedin,
    }),
    [name, role, email, phone, mobile, company, url, linkedin],
  );
  const frontNodes = useMemo(
    () => renderDesignElements(design.front, frontContext, "front"),
    [design.front, frontContext],
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
          {frontNodes}
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
  const design = template.design ?? DEFAULT_TEMPLATE_DESIGN;

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
  const backContext = useMemo(
    () => ({
      name,
      role,
      email,
      phone,
      mobile,
      company,
      url,
      linkedin,
      qrData,
    }),
    [name, role, email, phone, mobile, company, url, linkedin, qrData],
  );
  const backNodes = useMemo(
    () => renderDesignElements(design.back, backContext, "back"),
    [design.back, backContext],
  );

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
          {backNodes}

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
