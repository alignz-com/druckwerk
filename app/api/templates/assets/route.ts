import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getSignedUrl } from "@/lib/storage";

const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_TTL_MS = SIGNED_URL_TTL_SECONDS * 1000;

export const runtime = "nodejs";

type RefreshRequest = {
  storageKeys: string[];
};

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: RefreshRequest;
  try {
    payload = (await req.json()) as RefreshRequest;
  } catch (error) {
    console.error("[templates] Invalid refresh request body", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storageKeys = Array.isArray(payload?.storageKeys)
    ? Array.from(
        new Set(
          payload.storageKeys
            .map((key) => (typeof key === "string" ? key.trim() : ""))
            .filter((key) => key.length > 0),
        ),
      )
    : [];

  if (storageKeys.length === 0) {
    return NextResponse.json({ error: "storageKeys must be a non-empty array of strings" }, { status: 400 });
  }

  const issuedAt = Date.now();
  const expiresAtIso = new Date(issuedAt + SIGNED_URL_TTL_MS).toISOString();

  const urls = await Promise.all(
    storageKeys.map(async (storageKey) => {
      try {
        const url = await getSignedUrl(TEMPLATE_BUCKET, storageKey, SIGNED_URL_TTL_SECONDS);
        return { storageKey, url, expiresAt: expiresAtIso };
      } catch (error) {
        console.error(`[templates] Failed to refresh signed url for ${storageKey}`, error);
        return { storageKey, url: null, error: "Failed to sign" };
      }
    }),
  );

  return NextResponse.json({ urls });
}

