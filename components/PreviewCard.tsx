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
import { useFontFaceLoader } from "@/lib/useFontFaceLoader";
import { formatUrlForDisplay, normalizeWebUrl } from "@/lib/normalize-url";

const ASSET_CACHE_GRACE_MS = 30_000;
const FALLBACK_TEXT_FRAME = {
  xMm: 20,
  topMm: 18,
  columnWidthMm: 60,
  name: { font: "bold", sizePt: 10, lineGapMm: 2, letterSpacing: 0, color: "#000000" } as TemplateTextStyle,
  role: { font: "light", sizePt: 8, lineGapMm: 2, letterSpacing: 0, color: "#4b5563" } as TemplateTextStyle,
  contacts: { font: "light", sizePt: 8, lineGapMm: 2, letterSpacing: 0, color: "#1f2937" } as TemplateTextStyle,
  company: { font: "light", sizePt: 8, lineGapMm: 2, letterSpacing: 0, color: "#1f2937" } as TemplateTextStyle,
};
function getFrontConfig(template: ResolvedTemplate) {
  const front = (template.config as any)?.front ?? {};
  return {
    textFrame: front.textFrame ?? FALLBACK_TEXT_FRAME,
    preview: front.preview ?? {},
  };
}

function designContainsQr(elements: DesignElement[] | undefined): boolean {
  if (!elements) return false;
  for (const element of elements) {
    if (element.type === "qr") return true;
    if (element.type === "stack" && designContainsQr(element.items)) return true;
  }
  return false;
}

const assetCache = new Map<string, AssetState>();

function getAssetCacheKey(storageKey: string | null, assetType: string, fallbackUrl: string | null) {
  return storageKey ?? `${assetType}:${fallbackUrl ?? "none"}`;
}

function isExpired(expiresAt: number | null) {
  if (!expiresAt) return false;
  return Date.now() + ASSET_CACHE_GRACE_MS >= expiresAt;
}

function SmoothSvgImage({
  src,
  x,
  y,
  width,
  height,
  preserveAspectRatio = "xMidYMid meet",
  onError,
  onLoad,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preserveAspectRatio?: string;
  onError?: () => void;
  onLoad?: () => void;
}) {
  const [displaySrc, setDisplaySrc] = useState(src); // what SVG currently shows
  const [entering, setEntering] = useState(false); // drives opacity transition
  const hasPaintedOnceRef = useRef(false);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplaySrc(src);
      if (hasPaintedOnceRef.current) {
        setEntering(true);
        requestAnimationFrame(() => {
          setEntering(false);
        });
      } else {
        hasPaintedOnceRef.current = true;
        setEntering(false);
      }
      onLoad?.();
    };
    img.onerror = () => {/* keep old image on error */};
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  const animate = hasPaintedOnceRef.current;

  return (
    <image
      href={displaySrc}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio as any}
      className={animate ? `transition-opacity duration-300 ${entering ? "opacity-0" : "opacity-100"}` : "opacity-100"}
      onError={onError ? () => onError() : undefined}
    />
  );
}


export type Props = {
  name: string;
  role?: string;
  seniority?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string; // multiline
  url?: string;
  linkedin?: string;
  template: ResolvedTemplate;
  onOverflowChange?: (hasOverflow: boolean) => void;
  addressFields?: {
    companyName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  onReadyChange?: (ready: boolean) => void;
  onFieldOverflowChange?: (fields: string[]) => void;
  forcedBindingPrefixes?: string[];
  qrPreviewMode?: "vcard" | "public";
  qrPayload?: string | null;
};

/* ---------- Geometrie exakt wie im PDF (mm) ---------- */
const LEGACY_CARD_W = 85;
const LEGACY_CARD_H = 55;
const DEFAULT_PREVIEW_MAX_WIDTH = 960;
const DEFAULT_FONT_SCALE = 0.58;
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const SIGNED_URL_FALLBACK_TTL_MS = 60 * 60 * 1000;

const CARD_PIXEL_WIDTH = 1004;
const CARD_PIXEL_HEIGHT = 650;
const IMAGE_PIXEL_WIDTH = 1178;
const IMAGE_PIXEL_HEIGHT = 824;
const IMAGE_PADDING_PX = (IMAGE_PIXEL_WIDTH - CARD_PIXEL_WIDTH) / 2; // assuming symmetrical padding

const LEGACY_PX_TO_MM_X = LEGACY_CARD_W / CARD_PIXEL_WIDTH;
const LEGACY_PX_TO_MM_Y = LEGACY_CARD_H / CARD_PIXEL_HEIGHT;
const LEGACY_CANVAS_W = IMAGE_PIXEL_WIDTH * LEGACY_PX_TO_MM_X;
const LEGACY_CANVAS_H = IMAGE_PIXEL_HEIGHT * LEGACY_PX_TO_MM_Y;
const LEGACY_CANVAS_OFFSET_X = IMAGE_PADDING_PX * LEGACY_PX_TO_MM_X;
const LEGACY_CANVAS_OFFSET_Y = IMAGE_PADDING_PX * LEGACY_PX_TO_MM_Y;
const QR_PLACEHOLDER_DATA = "__QR_PLACEHOLDER__";

function getCanvasMetrics(template: ResolvedTemplate) {
  const trimWidthMm = template.pageWidthMm ?? null;
  const trimHeightMm = template.pageHeightMm ?? null;
  const canvasWidthMm = template.canvasWidthMm ?? null;
  const canvasHeightMm = template.canvasHeightMm ?? null;
  if (trimWidthMm && trimHeightMm && canvasWidthMm && canvasHeightMm) {
    return {
      canvasW: canvasWidthMm,
      canvasH: canvasHeightMm,
      offsetX: Math.max(0, (canvasWidthMm - trimWidthMm) / 2),
      offsetY: Math.max(0, (canvasHeightMm - trimHeightMm) / 2),
    };
  }
  if (trimWidthMm && trimHeightMm) {
    return {
      canvasW: trimWidthMm,
      canvasH: trimHeightMm,
      offsetX: 0,
      offsetY: 0,
    };
  }
  return {
    canvasW: LEGACY_CANVAS_W,
    canvasH: LEGACY_CANVAS_H,
    offsetX: LEGACY_CANVAS_OFFSET_X,
    offsetY: LEGACY_CANVAS_OFFSET_Y,
  };
}
const mmToPx = (mm: number) => (mm * 96) / 25.4;
const measurementCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

function measureTextWidthPx(
  text: string,
  fontFamily: string | undefined,
  fontSizePx: number,
  fontWeight?: number | string,
  fontStyle?: "normal" | "italic",
) {
  if (!text) return 0;
  if (!measurementCanvas) return text.length * fontSizePx * 0.6;
  const ctx = measurementCanvas.getContext("2d");
  if (!ctx) return text.length * fontSizePx * 0.6;
  const weight = fontWeight ? String(fontWeight) : "400";
  const family = fontFamily ?? "sans-serif";
  const style = fontStyle && fontStyle !== "normal" ? `${fontStyle} ` : "";
  ctx.font = `${style}${weight} ${fontSizePx}px ${family}`;
  return ctx.measureText(text).width;
}

type ClampResult = {
  text: string;
  truncated: boolean;
};

function clampTextToWidth(
  text: string,
  maxWidthMm: number,
  opts: {
    fontFamily?: string;
    fontSizeMm: number;
    fontWeight?: number | string;
    fontStyle?: "normal" | "italic";
    letterSpacingMm?: number;
  },
): ClampResult {
  if (!text) {
    return { text, truncated: false };
  }
  const maxWidthPx = mmToPx(maxWidthMm);
  const fontSizePx = mmToPx(opts.fontSizeMm);
  const letterSpacingPx = opts.letterSpacingMm ? mmToPx(opts.letterSpacingMm) : 0;

  const widthWithSpacing = (value: string) =>
    measureTextWidthPx(value, opts.fontFamily, fontSizePx, opts.fontWeight, opts.fontStyle) +
    Math.max(0, value.length - 1) * letterSpacingPx;

  if (widthWithSpacing(text) <= maxWidthPx) {
    return { text, truncated: false };
  }

  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const test = text.slice(0, mid) + ellipsis;
    if (widthWithSpacing(test) <= maxWidthPx) {
      best = test;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const clamped = best || "";
  return { text: clamped, truncated: Boolean(clamped && clamped !== text) };
}

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
  const cacheKey = getAssetCacheKey(asset?.storageKey ?? null, assetType, fallbackUrl);

  const [state, setState] = useState<AssetState>(() => {
    const cached = assetCache.get(cacheKey);
    if (cached && !isExpired(cached.expiresAt)) {
      return cached;
    }
    const initial = {
      storageKey: asset?.storageKey ?? null,
      url: asset?.publicUrl ?? fallbackUrl,
      expiresAt: normalizeExpiresAt(asset?.expiresAt),
    };
    assetCache.set(cacheKey, initial);
    return initial;
  });

  useEffect(() => {
    const nextState: AssetState = {
      storageKey: asset?.storageKey ?? null,
      url: asset?.publicUrl ?? fallbackUrl,
      expiresAt: normalizeExpiresAt(asset?.expiresAt),
    };

    setState((prev) => {
      if (
        prev.storageKey === nextState.storageKey &&
        prev.url === nextState.url &&
        prev.expiresAt === nextState.expiresAt
      ) {
        return prev;
      }
      assetCache.set(cacheKey, nextState);
      return nextState;
    });
  }, [asset?.storageKey, asset?.publicUrl, asset?.expiresAt, fallbackUrl, cacheKey]);

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
        const nextState = {
          storageKey,
          url: updated.url,
          expiresAt: nextExpiresAt,
        };
        assetCache.set(cacheKey, nextState);
        setState(nextState);
      }
    } catch (error) {
      console.error("[preview] Failed to refresh template asset URL", error);
    } finally {
      refreshingRef.current = false;
    }
  }, [storageKey, cacheKey]);

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
  if (parts.length === 0) return { text: "", bindings: [] };

  const bindingStates = new Map<string, { text: string; hasValue: boolean }>();
  const resolved = parts.map((part) => {
    if (part.type === "literal") {
      return { kind: "literal" as const, text: part.value, requires: part.requires ?? [] };
    }

    const raw = resolveField(context, part.field);
    let value: string | null = null;
    if (raw == null || (typeof raw === "string" && raw.trim().length === 0)) {
      value = part.fallback ?? null;
    } else if (Array.isArray(raw)) {
      value = raw.filter(Boolean).join(", ");
    } else {
      value = String(raw);
    }

    const hasValue = Boolean(value && value.trim().length > 0);
    const text = hasValue ? `${part.prefix ?? ""}${value}${part.suffix ?? ""}` : "";
    bindingStates.set(part.field, { text, hasValue });
    return { kind: "binding" as const, field: part.field, text, hasValue };
  });

  const pieces: string[] = [];
  for (const item of resolved) {
    if (item.kind === "binding") {
      if (item.hasValue) {
        pieces.push(item.text);
      }
      continue;
    }

    const ok = item.requires.length === 0 || item.requires.every((field) => bindingStates.get(field)?.hasValue);
    if (ok) {
      pieces.push(item.text);
    }
  }

  const joined = pieces.join("");
  if (joined.trim().length === 0) {
    return { text: "", bindings: [] };
  }
  return { text: joined, bindings: Array.from(bindingStates.keys()) };
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
  segments: Array<{ text: string; color?: string }>;
  fontSizeMm: number;
  lineHeightMm: number;
  isTruncated: boolean;
  bindings: string[];
};

function applySegmentStyles(
  text: string,
  rules: TextElement["segmentStyles"] | undefined,
  spotColors?: Array<{ name: string; rgbFallback: string }> | null,
): Array<{ text: string; color?: string }> {
  if (!text) return [];
  if (!rules || rules.length === 0) return [{ text }];

  let segments: Array<{ text: string; color?: string }> = [{ text }];
  for (const rule of rules) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(rule.pattern, rule.flags ?? "");
    } catch {
      continue;
    }

    // Resolve spot color to RGB for preview
    const resolvedColor = rule.spotColor
      ? resolveSpotColorRgb(rule.spotColor, spotColors) ?? rule.color
      : rule.color;

    const next: Array<{ text: string; color?: string }> = [];
    for (const segment of segments) {
      if (!segment.text) continue;
      if (segment.color) {
        next.push(segment);
        continue;
      }

      matcher.lastIndex = 0;
      const match = matcher.exec(segment.text);
      if (!match || match[0].length === 0) {
        next.push(segment);
        continue;
      }

      const start = match.index;
      const end = start + match[0].length;
      if (start > 0) {
        next.push({ text: segment.text.slice(0, start) });
      }
      next.push({ text: segment.text.slice(start, end), color: resolvedColor });
      if (end < segment.text.length) {
        next.push({ text: segment.text.slice(end) });
      }
    }
    segments = next;
  }
  return segments;
}

function prepareTextElement(element: TextElement, context: RenderContext, spotColors?: Array<{ name: string; rgbFallback: string }> | null): PreparedText | null {
  if (element.visibility && !evaluateVisibility(element.visibility, context)) {
    return null;
  }
  const fontSizeMm = ptToMm(element.font.sizePt);
  const fontStyle = element.font.style === "italic" ? "italic" : "normal";
  const { text: evaluated, bindings } = evaluateTextContent(element, context);
  const content = evaluated;
  if (!content) return null;
  let finalContent = content;
  let isTruncated = false;
  if (element.maxWidthMm) {
    const clamped = clampTextToWidth(content, element.maxWidthMm, {
      fontFamily: element.font.family,
      fontSizeMm,
      fontWeight: element.font.weight,
      fontStyle,
      letterSpacingMm: element.font.letterSpacing,
    });
    finalContent = clamped.text;
    isTruncated = clamped.truncated;
    if (!finalContent) return null;
  }
  const lineHeightMm = getLineHeightMm(element.font);
  const segments = applySegmentStyles(finalContent, element.segmentStyles, spotColors);
  return {
    element,
    content: finalContent,
    segments,
    fontSizeMm,
    lineHeightMm,
    isTruncated,
    bindings,
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

function renderTextElement(
  prepared: PreparedText,
  context: RenderContext,
  key: string,
  offsetX = 0,
  offsetY = 0,
  reportOverflow?: (fields?: string[]) => void,
  forceErrorColor = false,
) {
  const { element, fontSizeMm, content, segments, isTruncated, bindings } = prepared;
  const baseColor = element.font.color ?? "#1f2937";
  const fillColor = forceErrorColor || isTruncated ? "#ef4444" : baseColor;
  if (isTruncated) reportOverflow?.(bindings);

  const coloredSegments =
    forceErrorColor || isTruncated
      ? [{ text: content, color: fillColor }]
      : segments.length > 0
        ? segments
        : [{ text: content, color: undefined }];

  return (
    <text
      key={key}
      x={offsetX + (element.xMm ?? 0)}
      y={offsetY + (element.yMm ?? 0)}
      fontSize={fontSizeMm}
      fontFamily={element.font.family}
      fontWeight={element.font.weight ?? 400}
      fontStyle={element.font.style === "italic" ? "italic" : "normal"}
      fill={fillColor}
      dominantBaseline={element.font.baseline ?? "hanging"}
      letterSpacing={element.font.letterSpacing !== undefined ? String(element.font.letterSpacing) : undefined}
      textAnchor={element.textAnchor}
    >
      {coloredSegments.map((segment, index) => (
        <tspan key={`${key}-segment-${index}`} fill={segment.color ?? fillColor}>
          {segment.text}
        </tspan>
      ))}
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
  if (data === QR_PLACEHOLDER_DATA) {
    const size = element.sizeMm;
    const fontSize = Math.max(2, size * 0.18);
    return (
      <g key={key}>
        <rect
          x={element.xMm}
          y={element.yMm}
          width={size}
          height={size}
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth={0.25}
        />
        <text
          x={element.xMm + size / 2}
          y={element.yMm + size / 2}
          fontSize={fontSize}
          fontFamily="sans-serif"
          fontWeight={600}
          fill="#94a3b8"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          QR
        </text>
      </g>
    );
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

function findQrStyle(
  elements: DesignElement[] | undefined,
): { dark?: string; light?: string; spotColor?: string } | null {
  if (!elements) return null;
  for (const element of elements) {
    if (element.type === "qr") {
      return {
        dark: element.color,
        light: element.background,
        spotColor: element.spotColor,
      };
    }
    if (element.type === "stack") {
      const nested = findQrStyle(element.items);
      if (nested) return nested;
    }
  }
  return null;
}

function resolveSpotColorRgb(
  spotColorName: string | undefined,
  spotColors: Array<{ name: string; rgbFallback: string }> | null | undefined,
): string | null {
  if (!spotColorName || !spotColors) return null;
  const match = spotColors.find((sc) => sc.name === spotColorName);
  return match?.rgbFallback ?? null;
}

function normalizeQrColor(value?: string | null, fallback?: string) {
  if (!value) return fallback;
  const raw = value.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "transparent") return "#00000000";
  if (!raw.startsWith("#")) return raw;
  const hex = raw.slice(1);
  if (hex.length === 3) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 4) {
    const [r, g, b, a] = hex;
    return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
  }
  return raw;
}

type StackPreparedChild = {
  kind: "text";
  prepared: PreparedText;
} | {
  kind: "rect";
  element: RectElement;
};

function renderStackElement(
  element: StackElement,
  context: RenderContext,
  key: string,
  reportOverflow?: (fields?: string[]) => void,
  shouldForceBinding?: (binding: string) => boolean,
  spotColors?: Array<{ name: string; rgbFallback: string }> | null,
): ReactNode | null {
  if (element.visibility && element.visibility.binding) {
    if (!evaluateVisibility(element.visibility, context)) return null;
  }

  const preparedItems: Array<StackPreparedChild> = [];
  for (let index = 0; index < element.items.length; index += 1) {
    const child = element.items[index];
    if (child.type === "text") {
      const prepared = prepareTextElement(child, context, spotColors);
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
      const forceColor =
        shouldForceBinding &&
        item.prepared.bindings.some((binding) => shouldForceBinding(binding));
      const rendered = renderTextElement(
        item.prepared,
        context,
        `${key}-stack-${idx}`,
        0,
        cursorY,
        reportOverflow,
        Boolean(forceColor),
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

function renderDesignElements(
  elements: DesignElement[] | undefined,
  context: RenderContext,
  keyPrefix = "el",
  options?: { forceBindingPrefixes?: string[]; spotColors?: Array<{ name: string; rgbFallback: string }> | null },
): { nodes: ReactNode[]; overflowFields: string[] } {
  const forceBindingPrefixes = options?.forceBindingPrefixes ?? [];
  const nodes: ReactNode[] = [];
  if (!elements?.length) {
    return { nodes, overflowFields: [] };
  }
  const overflowFields = new Set<string>();

  const markOverflow = (fields?: string[]) => {
    if (fields && fields.length > 0) {
      fields.forEach((field) => {
        if (field) overflowFields.add(field);
      });
    } else {
      overflowFields.add("__unknown__");
    }
  };

  elements.forEach((element, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (element.type) {
      case "rect": {
        const rectNode = renderRectElement(element, context, key);
        if (rectNode) nodes.push(rectNode);
        break;
      }
      case "text": {
        const prepared = prepareTextElement(element, context, options?.spotColors);
        if (prepared) {
          const shouldForce = prepared.bindings.some((binding) =>
            forceBindingPrefixes.some((prefix) => binding === prefix || binding.startsWith(`${prefix}.`)),
          );
          nodes.push(renderTextElement(prepared, context, key, 0, 0, markOverflow, shouldForce));
        }
        break;
      }
      case "stack": {
        const stackNode = renderStackElement(
          element,
          context,
          key,
          markOverflow,
          (binding) => forceBindingPrefixes.some((prefix) => binding === prefix || binding.startsWith(`${prefix}.`)),
          options?.spotColors,
        );
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

  const overflowArray = Array.from(overflowFields).filter((field) => field !== "__unknown__");
  overflowArray.sort();
  return { nodes, overflowFields: overflowArray };
}

/* PDF-Fontgrößen in Punkt -> wir benutzen *die mm-Äquivalente als User-Units*.
   1pt = 1/72 inch; 1 inch = 25.4 mm -> pt to mm = 25.4/72 */
const ptToMm = (pt: number) => (pt * 25.4) / 72;


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
  seniority?: string;
  photoUrl?: string;
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
  const { fullName, org, title, seniority, photoUrl, email, phone, mobile, url, linkedin, addrLabel, address } = o;
  const normalizedUrl = normalizeWebUrl(url);
  const normalizedLinkedin = normalizeWebUrl(linkedin);

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
  if (seniority) lines.push(`ROLE:${vEscape(seniority)}`);
  if (photoUrl) lines.push(`PHOTO;VALUE=URI:${vEscape(photoUrl)}`);
  if (phone)  lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(phone)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,MOBILE:${vEscape(mobile)}`);
  if (email)  lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (normalizedUrl) lines.push(`URL;TYPE=Work:${vEscape(normalizedUrl)}`);
  if (normalizedLinkedin) lines.push(`URL;TYPE=LinkedIn:${vEscape(normalizedLinkedin)}`);

  const structuredLabelLines: string[] = [];
  if (address?.street) structuredLabelLines.push(address.street);
  const postalCity = [address?.postalCode, address?.city].filter(Boolean).join(" " ).trim();
  if (postalCity) structuredLabelLines.push(postalCity);
  if (address?.country) structuredLabelLines.push(address.country);
  if (address?.addressExtra) structuredLabelLines.push(address.addressExtra);
  const resolvedLabel = structuredLabelLines.length > 0 ? structuredLabelLines.join("\n") : addrLabel ?? "";

  if (structuredLabelLines.length > 0 || addrLabel) {
    const adr = [
      "",
      vEscape(address?.addressExtra ?? ""),
      vEscape(address?.street ?? ""),
      vEscape(address?.city ?? ""),
      "",
      vEscape(address?.postalCode ?? ""),
      vEscape(address?.country ?? ""),
    ];
    lines.push(`ADR;TYPE=WORK:${adr.join(";")}`);
    lines.push(`LABEL;TYPE=WORK:${vEscape(resolvedLabel)}`);
  } else if (addrLabel) {
    const adr = ["", "", vEscape(addrLabel), "", "", "", ""].join(";");
    lines.push(`ADR;TYPE=WORK:${adr}`);
    lines.push(`LABEL;TYPE=WORK:${vEscape(addrLabel)}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
/* ============================== FRONT ============================== */
export function BusinessCardFront({
  template,
  name,
  role = "",
  seniority = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
  linkedin,
  onOverflowChange,
  addressFields: _addressFields,
  onReadyChange,
  onFieldOverflowChange,
  forcedBindingPrefixes = [],
  qrPreviewMode = "vcard",
  qrPayload,
}: Props) {
  const { preview: previewCfg } = getFrontConfig(template);
  const fontRevision = useFontFaceLoader(template.fonts);
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;
  const { url: frontBackground, onError: handleFrontAssetError } = useTemplateAssetSource(
    template,
    "PREVIEW_FRONT",
    template.previewFrontPath,
  );
  const [backgroundReady, setBackgroundReady] = useState(false);
  useEffect(() => {
    if (!frontBackground) {
      setBackgroundReady(true);
    } else {
      setBackgroundReady(false);
    }
  }, [frontBackground]);
  useEffect(() => {
    onReadyChange?.(backgroundReady);
  }, [backgroundReady, onReadyChange]);
  const handleFrontBackgroundError = useCallback(() => {
    handleFrontAssetError?.();
    setBackgroundReady(true);
  }, [handleFrontAssetError]);
  const design = template.design ?? DEFAULT_TEMPLATE_DESIGN;
  const { canvasW, canvasH, offsetX, offsetY } = useMemo(
    () => getCanvasMetrics(template),
    [template.pageWidthMm, template.pageHeightMm, template.canvasWidthMm, template.canvasHeightMm],
  );
  const normalizedFrontAddress = useMemo(() => normalizeAddress(company), [company]);
  const companyLines = useMemo(
    () =>
      (company ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    [company],
  );
  const companyFirstLine = useMemo(() => {
    return companyLines[0] ?? "";
  }, [companyLines]);
  const companyPrimary = useMemo(() => {
    if (companyLines.length > 0) return companyLines[0];
    const org = normalizedFrontAddress.org?.trim();
    if (org && org.length > 0) return org;
    return companyFirstLine;
  }, [companyLines, normalizedFrontAddress, companyFirstLine]);
  const companySecondary = useMemo(() => {
    if (companyLines.length > 1) return companyLines.slice(1).join(" | ");
    const parts: string[] = [];
    if (normalizedFrontAddress.street) parts.push(normalizedFrontAddress.street);
    const postalCity = [normalizedFrontAddress.postalCode, normalizedFrontAddress.city].filter(Boolean).join(" ").trim();
    if (postalCity) parts.push(postalCity);
    if (normalizedFrontAddress.country) parts.push(normalizedFrontAddress.country);
    const candidate = parts.filter(Boolean).join(" | ");
    if (candidate) return candidate;
    return "";
  }, [companyLines, normalizedFrontAddress]);
  const frontAddressContext = useMemo(
    () => ({
      companyName: companyPrimary || undefined,
      street: normalizedFrontAddress.street ?? undefined,
      postalCode: normalizedFrontAddress.postalCode ?? undefined,
      city: normalizedFrontAddress.city ?? undefined,
      country: normalizedFrontAddress.country ?? undefined,
      addressExtra: undefined,
    }),
    [companyPrimary, normalizedFrontAddress],
  );
  const displayFrontUrl = useMemo(() => formatUrlForDisplay(url), [url]);
  const displayFrontLinkedin = useMemo(() => formatUrlForDisplay(linkedin), [linkedin]);
  const frontAddrLabel = useMemo(() => {
    const label = normalizedFrontAddress.label?.trim();
    if (label) return label;
    const fallback = (company || "").trim();
    return fallback || undefined;
  }, [normalizedFrontAddress.label, company]);
  const frontOrgForVcard = useMemo(() => {
    return normalizedFrontAddress.org?.trim() || companyPrimary || "";
  }, [normalizedFrontAddress.org, companyPrimary]);
  const [qrData, setQrData] = useState<string>("");
  const designFrontHasQr = useMemo(() => designContainsQr(design.front), [design.front]);
  const frontQrStyle = useMemo(() => findQrStyle(design.front), [design.front]);
  const frontContext = useMemo(
    () => ({
      name,
      role,
      seniority,
      email,
      phone,
      mobile,
      company,
      companyPrimary,
      companySecondary,
      companyLines,
      address: frontAddressContext,
      url: displayFrontUrl,
      linkedin: displayFrontLinkedin,
      qrData,
    }),
    [name, role, seniority, email, phone, mobile, company, companyPrimary, companySecondary, companyLines, frontAddressContext, displayFrontUrl, displayFrontLinkedin, qrData],
  );
  useEffect(() => {
    let stop = false;
    if (!designFrontHasQr) {
      setQrData("");
      return;
    }
    (async () => {
      try {
        const frontSpotRgb = resolveSpotColorRgb(frontQrStyle?.spotColor, template.spotColors);
        const frontQrDark = normalizeQrColor(frontSpotRgb ?? frontQrStyle?.dark, "#000000");
        const frontQrLight = normalizeQrColor(frontQrStyle?.light, "#00000000");
        if (qrPreviewMode === "public") {
          if (!qrPayload) {
            setQrData(QR_PLACEHOLDER_DATA);
            return;
          }
          const data = await QRCode.toDataURL(qrPayload, {
            margin: 0,
            errorCorrectionLevel: "M",
            scale: 8,
            color: { dark: frontQrDark, light: frontQrLight },
          });
          if (!stop) setQrData(data);
          return;
        }
        const vcard = buildVCard3({
          fullName: name,
          org: frontOrgForVcard || undefined,
          title: role || undefined,
          seniority: seniority || undefined,
          email: email || undefined,
          phone: phone || undefined,
          mobile: mobile || undefined,
          url: normalizeWebUrl(url) || undefined,
          linkedin: normalizeWebUrl(linkedin) || undefined,
          addrLabel: frontAddrLabel,
          address: {
            street: normalizedFrontAddress.street,
            postalCode: normalizedFrontAddress.postalCode,
            city: normalizedFrontAddress.city,
            country: normalizedFrontAddress.country,
          },
        });
        const data = await QRCode.toDataURL(vcard, {
          margin: 0,
          errorCorrectionLevel: "M",
          scale: 8,
          color: { dark: frontQrDark, light: frontQrLight },
        });
        if (!stop) setQrData(data);
      } catch {
        if (!stop) setQrData("");
      }
    })();
    return () => {
      stop = true;
    };
  }, [
    designFrontHasQr,
    qrPreviewMode,
    qrPayload,
    name,
    role,
    email,
    phone,
    mobile,
    url,
    linkedin,
    frontOrgForVcard,
    frontAddrLabel,
    normalizedFrontAddress.street,
    normalizedFrontAddress.postalCode,
    normalizedFrontAddress.city,
    normalizedFrontAddress.country,
    frontQrStyle?.dark,
    frontQrStyle?.light,
  ]);
  const { nodes: frontNodes, overflowFields: frontOverflowFields } = useMemo(() => {
    const result = renderDesignElements(design.front, frontContext, "front", {
      forceBindingPrefixes: forcedBindingPrefixes,
      spotColors: template.spotColors,
    });
    return result;
  }, [design.front, frontContext, forcedBindingPrefixes, fontRevision]);
  const frontOverflow = frontOverflowFields.length > 0;
  useEffect(() => {
    onOverflowChange?.(frontOverflow);
  }, [frontOverflow, onOverflowChange]);
  const frontOverflowKey = useMemo(() => frontOverflowFields.join("|"), [frontOverflowFields]);
  useEffect(() => {
    onFieldOverflowChange?.(frontOverflowFields);
  }, [frontOverflowKey, frontOverflowFields, onFieldOverflowChange]);
  const trimW = template.pageWidthMm ?? LEGACY_CARD_W;
  const trimH = template.pageHeightMm ?? LEGACY_CARD_H;
  return (
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${trimW} ${trimH}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", overflow: "visible", aspectRatio: `${trimW} / ${trimH}`, filter: undefined }}
        aria-label="Business card front"
      >
        <rect x={0} y={0} width={trimW} height={trimH} fill="white" />
        {frontBackground ? (
          <SmoothSvgImage
            src={frontBackground}
            x={0}
            y={0}
            width={trimW}
            height={trimH}
            preserveAspectRatio="none"
            onError={handleFrontBackgroundError}
            onLoad={() => setBackgroundReady(true)}
          />
        ) : null}

        <g className="[&>g]:opacity-100">
          {frontNodes}
        </g>

        <rect x={0.075} y={0.075} width={trimW - 0.15} height={trimH - 0.15} fill="none" stroke="#d1d5db" strokeWidth="0.15" />
      </svg>
      <figcaption className="sr-only">Card Front</figcaption>
    </figure>
  );
}

export function BusinessCardBack({
  template,
  name,
  role = "",
  seniority = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
  linkedin,
  onOverflowChange,
  addressFields,
  onReadyChange,
  onFieldOverflowChange,
  forcedBindingPrefixes = [],
  qrPreviewMode = "vcard",
  qrPayload,
}: Props) {
  const fontRevision = useFontFaceLoader(template.fonts);
  const normalized = useMemo(() => normalizeAddress(company), [company]);
  const { org: parsedOrg, label, street: parsedStreet, postalCode: parsedPostal, city: parsedCity, country: parsedCountry } = normalized;
  const addrLabel = (label && label.trim()) ? label : (company || undefined);
  const structuredOrg = addressFields?.companyName?.trim();
  const structuredStreet = addressFields?.street?.trim();
  const structuredPostal = addressFields?.postalCode?.trim();
  const structuredCity = addressFields?.city?.trim();
  const structuredCountry = addressFields?.country?.trim();
  const orgForVcard = structuredOrg || parsedOrg;
  const addrStreet = structuredStreet || parsedStreet || undefined;
  const addrPostal = structuredPostal || parsedPostal || undefined;
  const addrCity = structuredCity || parsedCity || undefined;
  const addrCountry = structuredCountry || parsedCountry || undefined;
  const { preview: previewCfg } = getFrontConfig(template);
  const design = template.design ?? DEFAULT_TEMPLATE_DESIGN;
  const designBackHasQr = useMemo(() => designContainsQr(design.back), [design.back]);
  const requiresQrData = designBackHasQr;
  const maxWidth = previewCfg.maxWidthPx ?? DEFAULT_PREVIEW_MAX_WIDTH;
  const { url: backBackground, onError: handleBackAssetError } = useTemplateAssetSource(
    template,
    "PREVIEW_BACK",
    template.previewBackPath,
  );
  const [backgroundReady, setBackgroundReady] = useState(false);
  useEffect(() => {
    if (!backBackground) {
      setBackgroundReady(true);
    } else {
      setBackgroundReady(false);
    }
  }, [backBackground]);
  useEffect(() => {
    onReadyChange?.(backgroundReady);
  }, [backgroundReady, onReadyChange]);
  const handleBackBackgroundError = useCallback(() => {
    handleBackAssetError?.();
    setBackgroundReady(true);
  }, [handleBackAssetError]);
  const normalizedBackUrl = useMemo(() => normalizeWebUrl(url), [url]);
  const normalizedBackLinkedin = useMemo(() => normalizeWebUrl(linkedin), [linkedin]);
  const displayBackUrl = useMemo(() => formatUrlForDisplay(url), [url]);
  const displayBackLinkedin = useMemo(() => formatUrlForDisplay(linkedin), [linkedin]);
  const { canvasW, canvasH, offsetX, offsetY } = useMemo(
    () => getCanvasMetrics(template),
    [template.pageWidthMm, template.pageHeightMm, template.canvasWidthMm, template.canvasHeightMm],
  );
  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org: orgForVcard,
        title: role || undefined,
        seniority: seniority || undefined,
        email: email || undefined,
        phone: phone || undefined,
        mobile: mobile || undefined,
        url: normalizedBackUrl || undefined,
        linkedin: normalizedBackLinkedin || undefined,
        addrLabel,
        address: {
          street: addrStreet,
          postalCode: addrPostal,
          city: addrCity,
          country: addrCountry,
        },
      }),
    [name, role, email, phone, mobile, normalizedBackUrl, normalizedBackLinkedin, orgForVcard, addrLabel, addrStreet, addrPostal, addrCity, addrCountry],
  );

  const [qrData, setQrData] = useState<string>("");

  useEffect(() => {
    let stop = false;
    if (!requiresQrData) {
      setQrData("");
      return;
    }
    (async () => {
      try {
        const backQrStyle = findQrStyle(design.back);
        const spotRgb = resolveSpotColorRgb(backQrStyle?.spotColor, template.spotColors);
        const qrDark = normalizeQrColor(spotRgb ?? backQrStyle?.dark, "#000000");
        const qrLight = normalizeQrColor(backQrStyle?.light, "#00000000");
        if (qrPreviewMode === "public") {
          if (!qrPayload) {
            setQrData(QR_PLACEHOLDER_DATA);
            return;
          }
          const data = await QRCode.toDataURL(qrPayload, {
            margin: 0,
            errorCorrectionLevel: "M",
            scale: 8,
            color: { dark: qrDark, light: qrLight },
          });
          if (!stop) setQrData(data);
          return;
        }
        const data = await QRCode.toDataURL(vcard, {
          margin: 0,
          errorCorrectionLevel: "M",
          scale: 8,
          color: { dark: qrDark, light: qrLight },
        });
        if (!stop) setQrData(data);
      } catch {
        if (!stop) setQrData("");
      }
    })();
    return () => {
      stop = true;
    };
  }, [vcard, requiresQrData, qrPreviewMode, qrPayload]);

  const backAddressContext = useMemo(
    () => ({
      street: addrStreet,
      postalCode: addrPostal,
      city: addrCity,
      country: addrCountry,
    }),
    [addrStreet, addrPostal, addrCity, addrCountry],
  );
  const backContext = useMemo(
    () => ({
      name,
      role,
      seniority,
      email,
      phone,
      mobile,
      company,
      url: displayBackUrl,
      linkedin: displayBackLinkedin,
      qrData,
      address: backAddressContext,
    }),
    [name, role, seniority, email, phone, mobile, company, displayBackUrl, displayBackLinkedin, qrData, backAddressContext],
  );
  const { nodes: backNodes, overflowFields: backOverflowFields } = useMemo(() => {
    const result = renderDesignElements(design.back, backContext, "back", {
      forceBindingPrefixes: forcedBindingPrefixes,
      spotColors: template.spotColors,
    });
    return result;
  }, [design.back, backContext, forcedBindingPrefixes, fontRevision]);
  const backOverflow = backOverflowFields.length > 0;
  useEffect(() => {
    onOverflowChange?.(backOverflow);
  }, [backOverflow, onOverflowChange]);
  const backOverflowKey = useMemo(() => backOverflowFields.join("|"), [backOverflowFields]);
  useEffect(() => {
    onFieldOverflowChange?.(backOverflowFields);
  }, [backOverflowKey, backOverflowFields, onFieldOverflowChange]);
  const trimW = template.pageWidthMm ?? LEGACY_CARD_W;
  const trimH = template.pageHeightMm ?? LEGACY_CARD_H;
  return (
    <figure className="select-none h-full w-full flex items-center justify-center">
      <svg
        className="block"
        viewBox={`0 0 ${trimW} ${trimH}`}
        width="100%"
        height="100%"
        style={{ maxWidth, height: "100%", width: "100%", display: "block", overflow: "visible", aspectRatio: `${trimW} / ${trimH}`, filter: undefined }}
        aria-label="Business card back"
      >
        <rect x={0} y={0} width={trimW} height={trimH} fill="white" />
        {backBackground ? (
          <SmoothSvgImage
            src={backBackground}
            x={0}
            y={0}
            width={trimW}
            height={trimH}
            preserveAspectRatio="none"
            onError={handleBackBackgroundError}
            onLoad={() => setBackgroundReady(true)}
          />
        ) : null}

        <g>{backNodes}</g>

        <rect x={0.075} y={0.075} width={trimW - 0.15} height={trimH - 0.15} fill="none" stroke="#d1d5db" strokeWidth="0.15" />
      </svg>
      <figcaption className="sr-only">Card Back</figcaption>
    </figure>
  );
}
