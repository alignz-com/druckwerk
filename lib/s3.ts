import { S3Client } from "@aws-sdk/client-s3";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

export const s3 = new S3Client({
  endpoint: requireEnv("S3_ENDPOINT"),
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY"),
    secretAccessKey: requireEnv("S3_SECRET_KEY"),
  },
  forcePathStyle: true, // required for MinIO
});

export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
export const TEMPLATE_BUCKET = process.env.S3_TEMPLATE_BUCKET ?? "templates";
export const FONT_BUCKET = process.env.S3_FONT_BUCKET ?? "fonts";
export const UPLOADS_BUCKET = process.env.S3_UPLOADS_BUCKET ?? "uploads";
export const ORDERS_BUCKET = process.env.S3_ORDERS_BUCKET ?? "orders";
