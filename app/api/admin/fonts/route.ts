"use server";

import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAdminFontFamilies } from "@/lib/admin/templates-data";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const families = await getAdminFontFamilies();
  return NextResponse.json({ families });
}
