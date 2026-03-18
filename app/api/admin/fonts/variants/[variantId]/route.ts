import { NextRequest, NextResponse } from "next/server";

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
  }

  const family = await getAdminFontFamily(variant.fontFamilyId);

  return NextResponse.json({ family });
}
