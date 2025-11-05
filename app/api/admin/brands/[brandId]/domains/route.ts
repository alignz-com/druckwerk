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

  let payload: { domain?: string };
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

  try {
    await prisma.brandDomain.create({
      data: {
        brandId,
        domain: domainInput,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
  }

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

  await prisma.brandDomain.deleteMany({ where: { id: domainId, brandId } });

  const updated = await getAdminBrand(brandId);

  return NextResponse.json({ brand: updated });
}
