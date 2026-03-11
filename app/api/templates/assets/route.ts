import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getTemplateAssetPublicUrl } from "@/lib/storage";

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

  const urls = storageKeys.map((storageKey) => ({
    storageKey,
    url: getTemplateAssetPublicUrl(storageKey),
  }));

  return NextResponse.json({ urls });
}

