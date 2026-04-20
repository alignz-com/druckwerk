"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import opentype from "opentype.js";

import type { ResolvedTemplate } from "./templates";
import type { DesignElement, TextElement } from "./template-design";

// ─── types ────────────────────────────────────────────────────────
type ParsedFont = {
  family: string;
  weight: number;
  style: string;
  font: opentype.Font;
};

export type GlyphCheckResult = {
  /** Fields that contain unsupported characters, mapped to the bad chars */
  unsupportedByField: Map<string, string[]>;
  /** True while fonts are still loading / parsing */
  loading: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────

/** Normalise a family name for matching (lowercase, strip whitespace). */
function normFamily(name: string | undefined): string {
  return (name ?? "").toLowerCase().replace(/\s+/g, "");
}

/** Characters we never warn about (whitespace, common punctuation, digits). */
function isCommonChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  // Basic ASCII printable (space through ~) — digits, punctuation, latin letters
  if (code >= 0x20 && code <= 0x7e) return true;
  // Common whitespace / control
  if (code <= 0x1f || code === 0x7f) return true;
  // Non-breaking space, soft hyphen
  if (code === 0xa0 || code === 0xad) return true;
  return false;
}

/** Check if a font has a real glyph for a character (not .notdef). */
function fontHasGlyph(font: opentype.Font, char: string): boolean {
  const glyph = font.charToGlyph(char);
  // charToGlyph returns the .notdef glyph (index 0) when the char is missing
  return glyph.index !== 0;
}

/**
 * Walk the design tree and collect which binding fields use which font family.
 * A single field can appear in multiple elements (front + back), so we collect
 * all families per binding.
 */
function extractBindingFonts(elements: DesignElement[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!elements) return map;

  function walk(els: DesignElement[]) {
    for (const el of els) {
      if (el.type === "text") {
        const text = el as TextElement;
        const family = normFamily(text.font.family);
        const bindings: string[] = [];

        if (text.binding) bindings.push(text.binding);
        if (text.parts) {
          for (const part of text.parts) {
            if (part.type === "binding") bindings.push(part.field);
          }
        }

        for (const b of bindings) {
          if (!map.has(b)) map.set(b, new Set());
          if (family) map.get(b)!.add(family);
        }
      }
      if (el.type === "stack" && "items" in el) {
        walk((el as any).items);
      }
    }
  }

  walk(elements);
  return map;
}

// ─── font cache (module-level, survives re-renders) ───────────────
const fontParseCache = new Map<string, Promise<ParsedFont | null>>();

function loadAndParseFont(
  url: string,
  family: string,
  weight: number,
  style: string,
): Promise<ParsedFont | null> {
  const cacheKey = url;
  const existing = fontParseCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      const font = opentype.parse(buffer);
      return { family: normFamily(family), weight, style, font };
    } catch {
      return null;
    }
  })();

  fontParseCache.set(cacheKey, promise);
  return promise;
}

// ─── hook ─────────────────────────────────────────────────────────

/**
 * Real-time glyph support checker.
 * Parses template fonts with opentype.js and checks whether the characters
 * in each form field can be rendered by the font used for that field in
 * the template design.
 *
 * @param template  The currently loaded template (with fonts + design)
 * @param fields    Map of binding name → current text value (e.g. { name: "Вячеслав" })
 */
export function useGlyphCheck(
  template: ResolvedTemplate | null,
  fields: Record<string, string>,
): GlyphCheckResult {
  const [parsedFonts, setParsedFonts] = useState<ParsedFont[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedTemplateKeyRef = useRef<string | null>(null);

  // ── 1. Parse fonts when template changes ──────────────────────
  useEffect(() => {
    if (!template?.fonts?.length) {
      setParsedFonts([]);
      setLoading(false);
      loadedTemplateKeyRef.current = null;
      return;
    }

    // Only TTF fonts can be parsed by opentype.js reliably
    const ttfFonts = template.fonts.filter(
      (f) => f.publicUrl && ["ttf", "otf", "woff", "woff2"].includes((f.format ?? "").toLowerCase()),
    );
    if (ttfFonts.length === 0) {
      setParsedFonts([]);
      setLoading(false);
      return;
    }

    const templateKey = template.key ?? ttfFonts.map((f) => f.storageKey).join("|");
    if (loadedTemplateKeyRef.current === templateKey) return;
    loadedTemplateKeyRef.current = templateKey;

    setLoading(true);
    void Promise.all(
      ttfFonts.map((f) =>
        loadAndParseFont(
          f.publicUrl!,
          f.fontFamilyName,
          f.weight ?? 400,
          (f.style ?? "normal").toLowerCase(),
        ),
      ),
    ).then((results) => {
      setParsedFonts(results.filter(Boolean) as ParsedFont[]);
      setLoading(false);
    });
  }, [template]);

  // ── 2. Build binding→fontFamilies map from design ─────────────
  const bindingFonts = useMemo(() => {
    if (!template?.design) return new Map<string, Set<string>>();
    const front = extractBindingFonts(template.design.front);
    const back = extractBindingFonts(template.design.back);
    // Merge back into front
    for (const [binding, families] of back) {
      if (!front.has(binding)) front.set(binding, new Set());
      for (const f of families) front.get(binding)!.add(f);
    }
    return front;
  }, [template?.design]);

  // ── 3. Check each field's characters against its fonts ────────
  const unsupportedByField = useMemo(() => {
    const result = new Map<string, string[]>();
    if (parsedFonts.length === 0) return result;

    for (const [field, value] of Object.entries(fields)) {
      if (!value) continue;

      // Which font families does this binding use?
      const families = bindingFonts.get(field);
      if (!families || families.size === 0) continue;

      // Find matching parsed fonts (pick best: regular weight, normal style)
      const matchedFonts: opentype.Font[] = [];
      for (const fam of families) {
        const candidates = parsedFonts.filter((pf) => pf.family === fam);
        if (candidates.length === 0) continue;
        // Prefer regular weight
        const best =
          candidates.find((c) => c.weight <= 400 && c.style === "normal") ??
          candidates.find((c) => c.style === "normal") ??
          candidates[0];
        if (best) matchedFonts.push(best.font);
      }

      if (matchedFonts.length === 0) continue;

      // Check each character
      const bad: string[] = [];
      const seen = new Set<string>();
      for (const ch of value) {
        if (seen.has(ch)) continue;
        seen.add(ch);
        if (isCommonChar(ch)) continue;

        // Character must be supported by ALL fonts used for this field
        const unsupported = matchedFonts.some((font) => !fontHasGlyph(font, ch));
        if (unsupported) bad.push(ch);
      }

      if (bad.length > 0) result.set(field, bad);
    }

    return result;
  }, [parsedFonts, bindingFonts, fields]);

  return { unsupportedByField, loading };
}
