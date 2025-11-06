import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getSignedUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storageKey = req.nextUrl.searchParams.get("storageKey");
  if (!storageKey) {
    return NextResponse.json({ error: "storageKey required" }, { status: 400 });
  }

  try {
    const signedUrl = await getSignedUrl(process.env.SUPABASE_FONT_BUCKET ?? "fonts", storageKey, 3600);
    return NextResponse.json({ url: signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to sign font" }, { status: 500 });
  }
}

