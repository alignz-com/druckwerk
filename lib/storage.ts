import { Buffer } from "node:buffer";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, PDFNumber } from "pdf-lib";
import { PNG } from "pngjs";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { TemplateAssetType } from "@prisma/client";
import { s3, S3_PUBLIC_URL, TEMPLATE_BUCKET, FONT_BUCKET } from "./s3";

type UploadOptions = {
  upsert?: boolean;
};

export type UploadResult = {
  storageKey: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
};

export type TemplateAssetUpload = {
  templateKey: string;
  version: number;
  type: TemplateAssetType | "pdf" | "preview_front" | "preview_back" | "config" | string;
  fileName: string;
  data: Uint8Array;
  contentType: string;
};

export type FontUpload = {
  familySlug: string;
  weight: number;
  style: "normal" | "italic";
  format: "ttf" | "otf" | "woff" | "woff2";
  fileName: string;
  data: Uint8Array;
  contentType: string;
};

export type SpotColor = {
  name: string;
  resourceName: string;
  page: number;
  alternateSpace: string;
  rgbFallback: string;
};

export type PdfMetadata = {
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  pageCount: number;
  trimWidthMm: number | null;
  trimHeightMm: number | null;
  spotColors: SpotColor[];
};

export type PngMetadata = {
  widthPx: number;
  heightPx: number;
  dpiX?: number;
  dpiY?: number;
  widthMm?: number;
  heightMm?: number;
};

export async function uploadTemplateAsset(input: TemplateAssetUpload, _opts: UploadOptions = {}): Promise<UploadResult> {
  const path = buildTemplateAssetPath(input.templateKey, input.version, input.fileName);
  await uploadToS3(TEMPLATE_BUCKET, path, input.data, input.contentType);
  return {
    storageKey: path,
    bucket: TEMPLATE_BUCKET,
    contentType: input.contentType,
    sizeBytes: input.data.byteLength,
  };
}

export async function uploadFontVariant(input: FontUpload, _opts: UploadOptions = {}): Promise<UploadResult> {
  const path = buildFontPath(input.familySlug, input.weight, input.style, input.format, input.fileName);
  await uploadToS3(FONT_BUCKET, path, input.data, input.contentType);
  return {
    storageKey: path,
    bucket: FONT_BUCKET,
    contentType: input.contentType,
    sizeBytes: input.data.byteLength,
  };
}

export async function deleteFontVariantObject(storageKey: string) {
  await deleteObject(FONT_BUCKET, storageKey);
}

export async function deleteObject(bucket: string, key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getSignedUrl(bucket: string, key: string, expiresInSeconds = 60) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return s3GetSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function extractPdfMetadata(buffer: Uint8Array): Promise<PdfMetadata> {
  const pdf = await PDFDocument.load(buffer);
  const pages = pdf.getPages();
  if (pages.length === 0) {
    throw new Error("PDF has no pages");
  }
  const firstPage = pages[0];
  const widthPt = firstPage.getWidth();
  const heightPt = firstPage.getHeight();
  const widthMm = ptToMm(widthPt);
  const heightMm = ptToMm(heightPt);

  // Extract TrimBox if present
  let trimWidthMm: number | null = null;
  let trimHeightMm: number | null = null;
  try {
    const trimBox = firstPage.getTrimBox();
    if (trimBox && trimBox.width > 0 && trimBox.height > 0) {
      trimWidthMm = ptToMm(trimBox.width);
      trimHeightMm = ptToMm(trimBox.height);
    }
  } catch {
    // TrimBox not present — that's fine
  }

  // Extract spot colors from all pages
  const spotColors: SpotColor[] = [];
  const seenNames = new Set<string>();
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    try {
      const pg = pages[pageIdx];
      const resources = pg.node.get(PDFName.of("Resources"));
      if (!resources) continue;
      const resDict = (resources instanceof PDFRef ? pdf.context.lookup(resources) : resources) as PDFDict;
      const colorSpacesRaw = resDict.get(PDFName.of("ColorSpace"));
      if (!colorSpacesRaw) continue;
      const csDict = (colorSpacesRaw instanceof PDFRef ? pdf.context.lookup(colorSpacesRaw) : colorSpacesRaw) as PDFDict;

      for (const [key, value] of csDict.entries()) {
        const resolved = (value instanceof PDFRef ? pdf.context.lookup(value) : value) as PDFArray;
        if (!(resolved instanceof PDFArray) || resolved.size() < 4) continue;
        const csType = resolved.get(0);
        const typeName = (csType instanceof PDFRef ? pdf.context.lookup(csType) : csType) as PDFName;
        if (typeName?.toString() !== "/Separation") continue;

        const rawName = resolved.get(1) as PDFName;
        const spotName = rawName.decodeText().replace(/^\//, "");
        if (spotName === "All" || spotName === "None" || seenNames.has(spotName)) continue;

        const altCS = resolved.get(2);
        const altCSResolved = (altCS instanceof PDFRef ? pdf.context.lookup(altCS) : altCS);
        let altSpaceName = "DeviceCMYK";
        if (altCSResolved instanceof PDFName) {
          altSpaceName = altCSResolved.toString().replace(/^\//, "");
        } else if (altCSResolved instanceof PDFArray && altCSResolved.size() > 0) {
          const first = altCSResolved.get(0);
          const firstName = (first instanceof PDFRef ? pdf.context.lookup(first) : first) as PDFName;
          altSpaceName = firstName?.toString()?.replace(/^\//, "") ?? "DeviceCMYK";
        }

        // Extract tint transform to compute RGB fallback at tint=1.0
        const tintFn = resolved.get(3);
        const tintDict = (tintFn instanceof PDFRef ? pdf.context.lookup(tintFn) : tintFn) as PDFDict;
        let rgbFallback = "#888888";
        try {
          if (tintDict instanceof PDFDict) {
            const c1Raw = tintDict.get(PDFName.of("C1"));
            if (c1Raw instanceof PDFArray) {
              const c1 = Array.from({ length: c1Raw.size() }, (_, i) => {
                const v = c1Raw.get(i);
                return parseFloat(v?.toString() ?? "0");
              });
              if (altSpaceName === "DeviceCMYK" && c1.length >= 4) {
                const [c, m, y, k] = c1;
                const r = Math.round(255 * (1 - c) * (1 - k));
                const g = Math.round(255 * (1 - m) * (1 - k));
                const b = Math.round(255 * (1 - y) * (1 - k));
                rgbFallback = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
              } else if (altSpaceName === "Lab" && c1.length >= 3) {
                // Lab to XYZ to sRGB (D65 illuminant)
                const [L, a, b] = c1;
                const fy = (L + 16) / 116;
                const fx = a / 500 + fy;
                const fz = fy - b / 200;
                const xr = fx > 6 / 29 ? fx ** 3 : (fx - 16 / 116) * 3 * (6 / 29) ** 2;
                const yr = fy > 6 / 29 ? fy ** 3 : (fy - 16 / 116) * 3 * (6 / 29) ** 2;
                const zr = fz > 6 / 29 ? fz ** 3 : (fz - 16 / 116) * 3 * (6 / 29) ** 2;
                const X = xr * 0.9505; const Y = yr * 1.0; const Z = zr * 1.089;
                const toSrgb = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v)));
                const rr = toSrgb(3.2406 * X - 1.5372 * Y - 0.4986 * Z);
                const gg = toSrgb(-0.9689 * X + 1.8758 * Y + 0.0415 * Z);
                const bb = toSrgb(0.0557 * X - 0.204 * Y + 1.057 * Z);
                rgbFallback = `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
              } else if (altSpaceName === "DeviceRGB" && c1.length >= 3) {
                const [r, g, b] = c1;
                rgbFallback = `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
              }
            }
          }
        } catch { /* fallback stays grey */ }

        seenNames.add(spotName);
        spotColors.push({
          name: spotName,
          resourceName: key.toString().replace(/^\//, ""),
          page: pageIdx,
          alternateSpace: altSpaceName,
          rgbFallback,
        });
      }
    } catch { /* skip page */ }
  }

  return {
    widthPt,
    heightPt,
    widthMm,
    heightMm,
    pageCount: pages.length,
    trimWidthMm,
    trimHeightMm,
    spotColors,
  };
}

export function extractPngMetadata(buffer: Uint8Array): PngMetadata {
  const png = PNG.sync.read(Buffer.from(buffer));
  const meta = png as any;
  let dpiX: number | undefined;
  let dpiY: number | undefined;
  let widthMm: number | undefined;
  let heightMm: number | undefined;

  if (meta.ppuX && meta.unitSpecifier === 1) {
    dpiX = meta.ppuX / 39.3701;
    widthMm = (png.width / dpiX) * 25.4;
  }
  if (meta.ppuY && meta.unitSpecifier === 1) {
    dpiY = meta.ppuY / 39.3701;
    heightMm = (png.height / dpiY) * 25.4;
  }

  return {
    widthPx: png.width,
    heightPx: png.height,
    dpiX,
    dpiY,
    widthMm,
    heightMm,
  };
}

export function buildTemplateAssetPath(templateKey: string, version: number, fileName: string) {
  const safeKey = slugify(templateKey);
  return `${safeKey}/v${version}/${sanitizeFileName(fileName)}`;
}

export function buildFontPath(familySlug: string, weight: number, style: string, format: string, _fileName: string) {
  const safeFamily = slugify(familySlug);
  return `${safeFamily}/${weight}${style === "italic" ? "i" : ""}.${format.toLowerCase()}`;
}

export function getTemplateAssetPublicUrl(storageKey: string) {
  return `${S3_PUBLIC_URL}/${TEMPLATE_BUCKET}/${storageKey}`;
}

async function uploadToS3(bucket: string, key: string, data: Uint8Array, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(data),
      ContentType: contentType,
    }),
  );
}

function ptToMm(pt: number) {
  return (pt * 25.4) / 72;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
