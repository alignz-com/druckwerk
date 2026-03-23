import { useEffect, useState } from "react";

import type { ResolvedTemplate } from "./templates";

const fontLoadCache = new Map<string, Promise<void>>();

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
