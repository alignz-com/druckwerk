import { Buffer } from "node:buffer";
import { PDFDocument } from "pdf-lib";
import { PNG } from "pngjs";
import { TemplateAssetType } from "@prisma/client";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";
const FONT_BUCKET = process.env.SUPABASE_FONT_BUCKET ?? "fonts";

const STORAGE_BASE_URL = `${SUPABASE_URL}/storage/v1/object`;

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

export type PdfMetadata = {
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  pageCount: number;
};

export type PngMetadata = {
  widthPx: number;
  heightPx: number;
  dpiX?: number;
  dpiY?: number;
  widthMm?: number;
  heightMm?: number;
};

export async function uploadTemplateAsset(input: TemplateAssetUpload, opts: UploadOptions = {}): Promise<UploadResult> {
  const path = buildTemplateAssetPath(input.templateKey, input.version, input.fileName);
  const response = await uploadToSupabase(TEMPLATE_BUCKET, path, input.data, input.contentType, opts);
  return {
    storageKey: path,
    bucket: TEMPLATE_BUCKET,
    contentType: input.contentType,
    sizeBytes: response.size,
  };
}

export async function uploadFontVariant(input: FontUpload, opts: UploadOptions = {}): Promise<UploadResult> {
  const path = buildFontPath(input.familySlug, input.weight, input.style, input.format, input.fileName);
  const response = await uploadToSupabase(FONT_BUCKET, path, input.data, input.contentType, opts);
  return {
    storageKey: path,
    bucket: FONT_BUCKET,
    contentType: input.contentType,
    sizeBytes: response.size,
  };
}

export async function deleteObject(bucket: string, key: string) {
  const url = `${STORAGE_BASE_URL}/${encodeURIComponent(bucket)}/${encodeStoragePath(key)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: supabaseHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete ${bucket}/${key}: ${res.status} ${text}`);
  }
}

export async function getSignedUrl(bucket: string, key: string, expiresInSeconds = 60) {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sign ${bucket}/${key}: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { signedURL: string };
  return `${SUPABASE_URL}${data.signedURL}`;
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

  return {
    widthPt,
    heightPt,
    widthMm,
    heightMm,
    pageCount: pages.length,
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

export function buildFontPath(familySlug: string, weight: number, style: string, format: string, fileName: string) {
  const safeFamily = slugify(familySlug);
  return `${safeFamily}/${weight}${style === "italic" ? "i" : ""}.${format.toLowerCase()}`;
}

async function uploadToSupabase(bucket: string, path: string, data: Uint8Array, contentType: string, opts: UploadOptions) {
  const url = `${STORAGE_BASE_URL}/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
  const body = Buffer.from(data);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": contentType,
      "x-upsert": opts.upsert ? "true" : "false",
    },
    body: body as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload to ${bucket}/${path}: ${res.status} ${text}`);
  }

  const size = data.byteLength;
  return { size };
}

function supabaseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
  };
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

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  return value;
}
