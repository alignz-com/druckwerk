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
const s3Port = (() => { try { const p = new URL(s3PublicUrl).port; return p || undefined; } catch { return undefined; } })();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // api.dth.at/v1/* → /api/v1/*
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
      // api.dth.at/docs/api → /docs/api
    ];
  },
  images: {
    remotePatterns: [
      // MinIO / self-hosted S3
      ...(s3Hostname
        ? [{ protocol: "http" as const, hostname: s3Hostname, ...(s3Port ? { port: s3Port } : {}) }, { protocol: "https" as const, hostname: s3Hostname, ...(s3Port ? { port: s3Port } : {}) }]
        : []),
      // Vercel Blob (legacy, can be removed once fully migrated)
      { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
