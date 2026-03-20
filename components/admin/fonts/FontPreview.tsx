"use client";

import { useEffect, useState } from "react";

type Props = {
  storageKey: string;
  format: string;
  familyName: string;
  weight?: number;
  style?: string;
  sampleText?: string;
  className?: string;
};

export function FontPreview({
  storageKey,
  format,
  familyName,
  weight = 400,
  style = "normal",
  sampleText = "Aa Bb Cc Dd Ee Ff Gg 0123456789",
  className,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Unique font family name to avoid conflicts
  const cssFamilyName = `preview-${storageKey.replace(/[^a-zA-Z0-9]/g, "-")}`;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(false);

    async function loadFont() {
      try {
        // Get signed URL
        const res = await fetch(`/api/admin/templates/fonts/url?storageKey=${encodeURIComponent(storageKey)}`);
        if (!res.ok) throw new Error();
        const { url } = await res.json();

        // Determine CSS format string
        const cssFormat = format === "WOFF2" ? "woff2" : format === "WOFF" ? "woff" : format === "TTF" ? "truetype" : "opentype";

        // Load font via FontFace API
        const font = new FontFace(cssFamilyName, `url(${url})`, {
          weight: String(weight),
          style: style === "ITALIC" ? "italic" : "normal",
        });

        const loadedFont = await font.load();
        if (cancelled) return;

        document.fonts.add(loadedFont);
        setLoaded(true);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    loadFont();
    return () => { cancelled = true; };
  }, [storageKey, format, weight, style, cssFamilyName]);

  if (error) return null;

  return (
    <p
      className={className}
      style={{
        fontFamily: loaded ? `"${cssFamilyName}", sans-serif` : "sans-serif",
        fontWeight: weight,
        fontStyle: style === "ITALIC" ? "italic" : "normal",
        opacity: loaded ? 1 : 0.3,
        transition: "opacity 0.3s ease",
      }}
    >
      {sampleText}
    </p>
  );
}
