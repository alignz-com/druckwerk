/**
 * Capture an SVG element as a PNG blob using the browser Canvas API.
 * Inlines external images and fonts as data URIs to avoid canvas tainting.
 */
export async function captureSvgAsPng(
  svgElement: SVGSVGElement,
  targetWidth = 600,
): Promise<Blob | null> {
  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // Remove opacity/transition styles that might hide the SVG
    clone.style.opacity = "1";
    clone.style.transition = "none";
    clone.classList.remove("transition-opacity");

    // Inline external images as data URIs
    const images = clone.querySelectorAll("image");
    await Promise.all(
      Array.from(images).map(async (img) => {
        const href = img.getAttribute("href") ?? img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (!href || href.startsWith("data:")) return;
        try {
          const res = await fetch(href);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const contentType = res.headers.get("content-type") ?? "image/png";
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const dataUri = `data:${contentType};base64,${base64}`;
          img.setAttribute("href", dataUri);
          img.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
        } catch {
          // Skip failed images
        }
      }),
    );

    // Wait for all fonts to finish loading before capturing
    await document.fonts.ready;

    // Embed @font-face rules from loaded document fonts
    const fontCss = await buildFontFaceCss();
    if (fontCss) {
      const defs = clone.querySelector("defs") ?? clone.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        clone.firstChild,
      );
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = fontCss;
      defs.appendChild(style);
    }

    // Get viewBox dimensions for aspect ratio
    const viewBox = clone.viewBox.baseVal;
    const vbW = viewBox.width || parseFloat(clone.getAttribute("viewBox")?.split(" ")[2] ?? "85");
    const vbH = viewBox.height || parseFloat(clone.getAttribute("viewBox")?.split(" ")[3] ?? "55");
    const targetHeight = Math.round(targetWidth * (vbH / vbW));

    // Set explicit dimensions on the clone
    clone.setAttribute("width", String(targetWidth));
    clone.setAttribute("height", String(targetHeight));
    clone.style.width = `${targetWidth}px`;
    clone.style.height = `${targetHeight}px`;
    clone.style.overflow = "hidden";
    clone.style.maxWidth = "";
    clone.style.filter = "";
    clone.style.display = "block";

    // Serialize to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Draw to canvas
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    return new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/png",
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

/**
 * Build @font-face CSS from all loaded FontFace entries.
 * Reads font data directly from FontFace.loaded ArrayBuffer when possible,
 * falls back to re-fetching the source URL.
 */
async function buildFontFaceCss(): Promise<string> {
  const rules: string[] = [];
  const seen = new Set<string>();

  for (const face of document.fonts) {
    if (face.status !== "loaded") continue;
    const family = face.family.replace(/['"]/g, "");
    const key = `${family}-${face.weight}-${face.style}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      let base64: string | null = null;
      let format = "truetype";

      // Extract URL from the FontFace source CSS value
      const srcStr = String((face as any).src ?? (face as any).source ?? "");
      const urlMatch = srcStr.match(/url\(["']?([^"')]+)["']?\)/);
      const fontUrl = urlMatch?.[1];

      if (fontUrl) {
        format = fontUrl.includes(".woff2") ? "woff2"
          : fontUrl.includes(".woff") ? "woff"
          : fontUrl.includes(".otf") ? "opentype"
          : "truetype";
      }

      // Strategy 1: extract from existing stylesheets in the document
      // The preview component loads fonts via @font-face in stylesheets
      if (!base64) {
        base64 = await extractFontFromStylesheets(family, face.weight, face.style);
      }

      // Strategy 2: re-fetch the font URL (may fail if signed URL expired)
      if (!base64 && fontUrl && !fontUrl.startsWith("data:")) {
        try {
          const res = await fetch(fontUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            base64 = arrayBufferToBase64(buf);
          }
        } catch {
          // URL might be expired or CORS blocked
        }
      }

      if (!base64) continue;

      rules.push(
        `@font-face { font-family: '${family}'; font-weight: ${face.weight}; font-style: ${face.style}; src: url(data:font/${format};base64,${base64}) format('${format}'); }`,
      );
    } catch {
      // Skip failed fonts
    }
  }

  return rules.join("\n");
}

/**
 * Try to find the font data URL from existing stylesheets in the document.
 * The PreviewCard component injects @font-face rules with data URIs or signed URLs.
 */
async function extractFontFromStylesheets(
  family: string,
  weight: string,
  style: string,
): Promise<string | null> {
  try {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // Cross-origin stylesheet
      }
      for (const rule of rules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const ruleFamily = rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim();
        const ruleWeight = rule.style.getPropertyValue("font-weight").trim() || "normal";
        const ruleStyle = rule.style.getPropertyValue("font-style").trim() || "normal";

        if (ruleFamily !== family) continue;
        if (String(ruleWeight) !== String(weight)) continue;
        if (ruleStyle !== style) continue;

        const src = rule.style.getPropertyValue("src");
        // Check for inline data URI
        const dataMatch = src.match(/url\(["']?(data:[^"')]+)["']?\)/);
        if (dataMatch) {
          const dataUri = dataMatch[1];
          const base64Part = dataUri.split(",")[1];
          if (base64Part) return base64Part;
        }

        // Check for URL and fetch it
        const urlMatch = src.match(/url\(["']?(https?:[^"')]+)["']?\)/);
        if (urlMatch) {
          try {
            const res = await fetch(urlMatch[1]);
            if (res.ok) {
              return arrayBufferToBase64(await res.arrayBuffer());
            }
          } catch {
            continue;
          }
        }
      }
    }
  } catch {
    // Stylesheet access can throw in some browsers
  }
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
