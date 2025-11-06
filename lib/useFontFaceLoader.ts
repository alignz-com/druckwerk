import { useEffect } from "react";

import type { ResolvedTemplate } from "./templates";

const fontLoadCache = new Map<string, Promise<void>>();

export function useFontFaceLoader(fonts: ResolvedTemplate["fonts"] | undefined) {
  useEffect(() => {
    if (!fonts?.length) return;

    fonts.forEach((font) => {
      const cacheKey = `${font.fontFamilyName}-${font.weight}-${font.style}-${font.storageKey}`;
      if (fontLoadCache.has(cacheKey)) return;

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
        } catch (error) {
          console.warn("[preview] failed to load font face", error);
        }
      })();

      fontLoadCache.set(cacheKey, loader);
    });
  }, [fonts]);
}
