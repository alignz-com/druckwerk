import type { NextConfig } from "next";

const s3PublicUrl = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";

function parseRemoteHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const s3Hostname = parseRemoteHostname(s3PublicUrl);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // MinIO / self-hosted S3
      ...(s3Hostname
        ? [{ protocol: "http" as const, hostname: s3Hostname }, { protocol: "https" as const, hostname: s3Hostname }]
        : []),
      // Vercel Blob (legacy, can be removed once fully migrated)
      { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
