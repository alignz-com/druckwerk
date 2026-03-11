"use server";

import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminBrand } from "@/lib/admin/brands-data";

type RouteParams = { brandId: string };

async function resolveParams(context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  if (!params?.brandId) {
    throw new Error("Missing route parameter: brandId");
  }
  return params;
}

export async function POST(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);

  let payload: { domain?: string; isPrimary?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const domainInput = payload?.domain?.trim().toLowerCase();
  if (!domainInput) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const existingCount = await prisma.brandPublicDomain.count({ where: { brandId } });
  const makePrimary = payload?.isPrimary ?? existingCount === 0;

  try {
    await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.brandPublicDomain.updateMany({
          where: { brandId },
          data: { isPrimary: false },
        });
      }
      await tx.brandPublicDomain.create({
        data: {
          brandId,
          domain: domainInput,
          isPrimary: makePrimary,
        },
      });
    });
  } catch (error) {
    return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
  }

  const updated = await getAdminBrand(brandId);

  return NextResponse.json({ brand: updated });
}

export async function PATCH(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);

  let payload: { domainId?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    return NextResponse.json({ error: "domainId is required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.brandPublicDomain.updateMany({
      where: { brandId },
      data: { isPrimary: false },
    });
    await tx.brandPublicDomain.updateMany({
      where: { id: domainId, brandId },
      data: { isPrimary: true },
    });
  });

  const updated = await getAdminBrand(brandId);

  return NextResponse.json({ brand: updated });
}

export async function DELETE(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);

  let payload: { domainId?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const domainId = payload?.domainId?.trim();
  if (!domainId) {
    return NextResponse.json({ error: "domainId is required" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.brandPublicDomain.deleteMany({ where: { id: domainId, brandId } });
    if (deleted.count > 0) {
      const remaining = await tx.brandPublicDomain.findMany({
        where: { brandId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 1,
      });
      if (remaining.length > 0 && !remaining[0].isPrimary) {
        await tx.brandPublicDomain.update({
          where: { id: remaining[0].id },
          data: { isPrimary: true },
        });
      }
    }
  });

  const updated = await getAdminBrand(brandId);

  return NextResponse.json({ brand: updated });
}
