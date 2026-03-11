import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getTemplateByKey } from "@/lib/templates";

export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing template key" }, { status: 400 });
  }

  const brandId = request.nextUrl.searchParams.get("brandId");

  try {
    const template = await getTemplateByKey(key, brandId);
    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to resolve template" }, { status: 404 });
  }
}

