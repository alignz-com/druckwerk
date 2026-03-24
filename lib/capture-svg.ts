/**
 * Capture an SVG element as a PNG blob using the browser Canvas API.
 * Inlines external images as data URIs to avoid canvas tainting.
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
 * Fetches font URLs and inlines them as base64 data URIs.
 */
async function buildFontFaceCss(): Promise<string> {
  const rules: string[] = [];
  const seen = new Set<string>();

  for (const face of document.fonts) {
    if (face.status !== "loaded") continue;
    const key = `${face.family}-${face.weight}-${face.style}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Extract URL from the FontFace source
    const src = (face as any).src ?? (face as any).source;
    if (!src || typeof src !== "string") continue;

    const urlMatch = src.match(/url\(([^)]+)\)/);
    if (!urlMatch) continue;
    const fontUrl = urlMatch[1].replace(/['"]/g, "");

    try {
      const res = await fetch(fontUrl);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const format = fontUrl.includes(".woff2") ? "woff2" : fontUrl.includes(".woff") ? "woff" : fontUrl.includes(".otf") ? "opentype" : "truetype";
      rules.push(
        `@font-face { font-family: ${face.family}; font-weight: ${face.weight}; font-style: ${face.style}; src: url(data:font/${format};base64,${base64}) format('${format}'); }`,
      );
    } catch {
      // Skip failed fonts
    }
  }

  return rules.join("\n");
}
