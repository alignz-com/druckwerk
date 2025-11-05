"use server";

import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminFontFamilies, getAdminFontFamily } from "@/lib/admin/templates-data";
import { fontFamilySchema, ensureUniqueFontSlug, slugifyFontFamily } from "./util";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const families = await getAdminFontFamilies();
  return NextResponse.json({ families });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = fontFamilySchema.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const baseSlug = slugifyFontFamily(parsed.slug ?? parsed.name);
  const slug = await ensureUniqueFontSlug(baseSlug);

  const family = await prisma.fontFamily.create({
    data: {
      name: parsed.name,
      slug,
      defaultWeight: parsed.defaultWeight ?? null,
      defaultStyle: parsed.defaultStyle ?? null,
      notes: parsed.notes ?? null,
    },
  });

  const result = await getAdminFontFamily(family.id);

  return NextResponse.json({ family: result }, { status: 201 });
}
