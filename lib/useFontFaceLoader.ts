import { useEffect, useState } from "react";

import type { ResolvedTemplate } from "./templates";

const fontLoadCache = new Map<string, Promise<void>>();

/**
 * Global registry of loaded font URLs, keyed by "family-weight-style".
 * Used by capture-svg.ts to inline fonts into SVG for thumbnail generation.
 */
export const loadedFontUrls = new Map<
  string,
  { family: string; weight: string; style: string; url: string; format: string }
>();

export function useFontFaceLoader(fonts: ResolvedTemplate["fonts"] | undefined) {
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fonts?.length) {
      setReady(true);
      return;
    }

    const pending: Promise<void>[] = [];
    fonts.forEach((font) => {
      const cacheKey = `${font.fontFamilyName}-${font.weight}-${font.style}-${font.storageKey}`;
      const existing = fontLoadCache.get(cacheKey);
      if (existing) {
        pending.push(existing);
        return;
      }

      const loader = (async () => {
        try {
          const url = font.publicUrl;
          if (!url) return;

          const face = new FontFace(
            font.fontFamilyName,
            `url(${url})`,
            {
              weight: font.weight ? String(font.weight) : undefined,
              style: font.style.toLowerCase() === "italic" ? "italic" : "normal",
            },
          );
          await face.load();
          document.fonts.add(face);

          // Register URL for SVG capture
          const weight = font.weight ? String(font.weight) : "400";
          const style = font.style.toLowerCase() === "italic" ? "italic" : "normal";
          const format = font.format?.toLowerCase() ?? "truetype";
          const registryKey = `${font.fontFamilyName}-${weight}-${style}`;
          loadedFontUrls.set(registryKey, {
            family: font.fontFamilyName,
            weight,
            style,
            url,
            format: format === "woff2" ? "woff2" : format === "woff" ? "woff" : format === "otf" ? "opentype" : "truetype",
          });
        } catch (error) {
          console.warn("[preview] failed to load font face", error);
        }
      })();

      fontLoadCache.set(cacheKey, loader);
      pending.push(loader);
    });

    if (pending.length === 0) {
      setReady(true);
      return;
    }
    void Promise.allSettled(pending).then(() => {
      setReady(true);
      setRevision((current) => current + 1);
    });
  }, [fonts]);

  return { revision, ready };
}
