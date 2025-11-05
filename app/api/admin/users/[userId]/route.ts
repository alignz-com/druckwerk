"use server";

import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapAdminUser } from "@/lib/admin/users-data";

type RouteParams = { userId: string };

export async function PATCH(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = params;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  let payload: { brandId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandIdRaw = payload?.brandId;
  const brandId = typeof brandIdRaw === "string" && brandIdRaw.trim().length > 0 ? brandIdRaw.trim() : null;

  if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      brandId,
    },
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: { brand: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ user: updated ? mapAdminUser(updated as any) : null });
}
