import { NextRequest, NextResponse } from "next/server";
import { FontStyle } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFontVariantObject } from "@/lib/storage";
import { getAdminFontFamily } from "@/lib/admin/templates-data";

type RouteParams = { variantId: string };

async function resolveParams(context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  if (!params?.variantId) {
    throw new Error("Missing route parameter: variantId");
  }
  return params;
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { variantId } = await resolveParams(context);
  const variant = await prisma.fontVariant.findUnique({ where: { id: variantId } });
  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: { weight?: number; style?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof payload.weight === "number" && payload.weight >= 100 && payload.weight <= 900) {
    data.weight = payload.weight;
  }
  if (typeof payload.style === "string") {
    const s = payload.style.toUpperCase();
    if (s === "NORMAL" || s === "ITALIC") {
      data.style = s as FontStyle;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.fontVariant.update({ where: { id: variantId }, data });
  const family = await getAdminFontFamily(variant.fontFamilyId);

  return NextResponse.json({ family });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { variantId } = await resolveParams(context);
  const variant = await prisma.fontVariant.findUnique({
    where: { id: variantId },
    select: { id: true, storageKey: true, fontFamilyId: true },
  });

  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.fontVariant.delete({ where: { id: variantId } });

  if (variant.storageKey) {
    try {
      await deleteFontVariantObject(variant.storageKey);
    } catch (error) {
      console.error("[admin] delete font variant storage failed", error);
    }
    // Remove font locally for pdftocairo
    const { removeFont } = await import("@/lib/font-sync");
    await removeFont(variant.storageKey).catch((err) =>
      console.warn("[admin/fonts] local font removal failed:", err)
    );
  }

  const family = await getAdminFontFamily(variant.fontFamilyId);

  return NextResponse.json({ family });
}
