/**
 * Drop-in replacement for @vercel/blob using MinIO (S3-compatible).
 *
 * Bucket routing by path prefix:
 *   photos/…       → uploads bucket  (user photo uploads, short lifecycle)
 *   everything else → orders bucket   (generated PDFs, JDFs, delivery notes)
 */
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, UPLOADS_BUCKET, ORDERS_BUCKET, S3_PUBLIC_URL } from "./s3";

type PutOptions = {
  access?: "public";
  contentType?: string;
  allowOverwrite?: boolean;
  token?: string; // ignored — kept for API compatibility
};

type PutResult = {
  url: string;
  pathname: string;
};

function bucketFor(pathname: string): string {
  if (pathname.startsWith("photos/") || pathname.startsWith("logos/") || pathname.startsWith("features/")) return UPLOADS_BUCKET;
  return ORDERS_BUCKET;
}

export async function put(
  pathname: string,
  data: Blob | Buffer | ArrayBuffer | string,
  options: PutOptions = {},
): Promise<PutResult> {
  const buffer =
    data instanceof Blob
      ? Buffer.from(await data.arrayBuffer())
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);

  const bucket = bucketFor(pathname);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pathname,
      Body: buffer,
      ContentType: options.contentType ?? "application/octet-stream",
    }),
  );

  const url = `${S3_PUBLIC_URL}/${bucket}/${pathname}`;
  return { url, pathname };
}

export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  await Promise.allSettled(
    urls.map((url) => {
      const parsed = parseUrl(url);
      if (!parsed) return Promise.resolve();
      return s3.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
    }),
  );
}

function parseUrl(url: string): { bucket: string; key: string } | null {
  try {
    // URL format: http://host:port/bucket/some/key
    const parts = new URL(url).pathname.slice(1).split("/");
    const bucket = parts[0];
    const key = parts.slice(1).join("/");
    return bucket && key ? { bucket, key } : null;
  } catch {
    return null;
  }
}
