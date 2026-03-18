import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFontVariantObject } from "@/lib/storage";
import { getAdminFontFamily } from "@/lib/admin/templates-data";
import { ensureUniqueFontSlug, fontFamilySchema, slugifyFontFamily } from "../util";

type RouteParams = { familyId: string };

async function resolveParams(context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  if (!params?.familyId) {
    throw new Error("Missing route parameter: familyId");
  }
  return params;
}

export async function GET(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { familyId } = await resolveParams(context);
  const family = await getAdminFontFamily(familyId);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ family });
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { familyId } = await resolveParams(context);
  const existing = await prisma.fontFamily.findUnique({ where: { id: familyId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const targetName = parsed.name ?? existing.name;
  const requestedSlug = parsed.slug ?? existing.slug ?? slugifyFontFamily(targetName);
  const baseSlug = slugifyFontFamily(requestedSlug);
  const slug = await ensureUniqueFontSlug(baseSlug, familyId);

  await prisma.fontFamily.update({
    where: { id: familyId },
    data: {
      name: targetName,
      slug,
      defaultWeight: parsed.defaultWeight ?? null,
      defaultStyle: parsed.defaultStyle ?? null,
      notes: parsed.notes ?? null,
    },
  });

  const family = await getAdminFontFamily(familyId);
  return NextResponse.json({ family });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { familyId } = await resolveParams(context);
  const family = await prisma.fontFamily.findUnique({
    where: { id: familyId },
    include: {
      variants: {
        select: { id: true, storageKey: true },
      },
    },
  });

  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  for (const variant of family.variants) {
    if (variant.storageKey) {
      try {
        await deleteFontVariantObject(variant.storageKey);
      } catch (error) {
        console.error("[admin] delete font variant storage failed", error);
      }
    }
  }

  await prisma.fontFamily.delete({ where: { id: familyId } });

  return NextResponse.json({ success: true });
}
