import { Buffer } from "node:buffer";
import { PDFDocument } from "pdf-lib";
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
