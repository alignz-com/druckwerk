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
          const base64 = arrayBufferToBase64(buf);
          const dataUri = `data:${contentType};base64,${base64}`;
          img.setAttribute("href", dataUri);
          img.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
        } catch {
          // Skip failed images
        }
      }),
    );

    // Wait for all fonts to finish loading
    await document.fonts.ready;

    // Embed @font-face rules with inlined font data into the SVG
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
 * Build @font-face CSS with inlined base64 font data from all loaded FontFace entries.
 *
 * Fonts are loaded via `new FontFace(name, "url(...)") + document.fonts.add(face)`
 * in useFontFaceLoader.ts. The `face.src` property contains the CSS src value.
 *
 * We re-fetch the font URL and inline the binary as a data URI so the serialized
 * SVG can render text correctly in the sandboxed <img> context.
 */
async function buildFontFaceCss(): Promise<string> {
  const rules: string[] = [];
  const seen = new Set<string>();

  // Collect all font faces to process
  const faces: FontFace[] = [];
  document.fonts.forEach((face) => {
    if (face.status === "loaded") faces.push(face);
  });

  // Process all fonts in parallel for speed
  await Promise.all(
    faces.map(async (face) => {
      const family = face.family.replace(/['"]/g, "");
      const weight = face.weight || "400";
      const style = face.style || "normal";
      const key = `${family}-${weight}-${style}`;

      if (seen.has(key)) return;
      seen.add(key);

      try {
        // The FontFace.src property is a CSSOMString like: url("https://files.dth.at/fonts/...")
        const srcValue = (face as any).src;
        if (!srcValue || typeof srcValue !== "string") {
          console.warn(`[capture] no src for font ${key}`);
          return;
        }

        // Extract the URL from the CSS url() value
        const urlMatch = srcValue.match(/url\(["']?([^"')]+)["']?\)/);
        if (!urlMatch) {
          console.warn(`[capture] cannot parse src for font ${key}:`, srcValue.substring(0, 100));
          return;
        }

        const fontUrl = urlMatch[1];
        if (!fontUrl || fontUrl.startsWith("data:")) return;

        const format = fontUrl.includes(".woff2") ? "woff2"
          : fontUrl.includes(".woff") ? "woff"
          : fontUrl.includes(".otf") ? "opentype"
          : "truetype";

        const res = await fetch(fontUrl);
        if (!res.ok) {
          console.warn(`[capture] font fetch failed for ${key}: ${res.status}`);
          return;
        }

        const buf = await res.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);

        rules.push(
          `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; src: url(data:font/${format};base64,${base64}) format('${format}'); }`,
        );
      } catch (err) {
        console.warn(`[capture] font inline failed for ${key}:`, err);
      }
    }),
  );

  if (rules.length > 0) {
    console.log(`[capture] inlined ${rules.length} fonts`);
  } else if (faces.length > 0) {
    console.warn(`[capture] ${faces.length} fonts loaded but none could be inlined`);
  }

  return rules.join("\n");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Use chunks to avoid call stack overflow on large buffers
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}
