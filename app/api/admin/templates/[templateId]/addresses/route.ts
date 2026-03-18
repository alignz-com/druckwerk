"use server";

import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { templateId: string };

export async function GET(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const assignments = await prisma.brandTemplate.findMany({
    where: { templateId },
    include: { brand: true },
    orderBy: [{ assignedAt: "asc" }],
  });

  const brandIds = assignments.map((assignment) => assignment.brandId);
  if (brandIds.length === 0) {
    return NextResponse.json({ brands: [] });
  }

  const [addresses, templateAddresses] = await Promise.all([
    prisma.brandAddress.findMany({
      where: { brandId: { in: brandIds } },
      orderBy: [{ label: "asc" }, { company: "asc" }],
      select: {
        id: true,
        brandId: true,
        label: true,
        company: true,
        street: true,
        postalCode: true,
        city: true,
        countryCode: true,
      },
    }),
    prisma.templateAddress.findMany({
      where: { templateId, brandAddress: { brandId: { in: brandIds } } },
      select: {
        brandAddressId: true,
        brandAddress: { select: { brandId: true } },
      },
    }),
  ]);

  const addressesByBrand = new Map<string, typeof addresses>();
  for (const address of addresses) {
    if (!addressesByBrand.has(address.brandId)) {
      addressesByBrand.set(address.brandId, []);
    }
    addressesByBrand.get(address.brandId)!.push(address);
  }

  const assignedByBrand = new Map<string, string[]>();
  for (const entry of templateAddresses) {
    const brandId = entry.brandAddress.brandId;
    if (!assignedByBrand.has(brandId)) {
      assignedByBrand.set(brandId, []);
    }
    assignedByBrand.get(brandId)!.push(entry.brandAddressId);
  }

  const brands = assignments
    .filter((assignment) => Boolean(assignment.brand))
    .map((assignment) => ({
      brandId: assignment.brandId,
      brandName: assignment.brand!.name,
      addresses: addressesByBrand.get(assignment.brandId) ?? [],
      assignedAddressIds: assignedByBrand.get(assignment.brandId) ?? [],
    }));

  return NextResponse.json({ brands });
}

export async function PUT(req: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: { brandId?: string; addressIds?: string[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = String(payload?.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const hasAssignment = await prisma.brandTemplate.findFirst({
    where: { templateId, brandId },
    select: { id: true },
  });
  if (!hasAssignment) {
    return NextResponse.json({ error: "Brand is not assigned to this template" }, { status: 400 });
  }

  const requestedIds = Array.isArray(payload.addressIds)
    ? payload.addressIds.map((id) => String(id)).filter(Boolean)
    : [];

  const allowedAddresses = await prisma.brandAddress.findMany({
    where: { brandId },
    select: { id: true },
  });
  const allowedIds = new Set(allowedAddresses.map((address) => address.id));
  const invalidIds = requestedIds.filter((id) => !allowedIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: "Invalid address selection" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.templateAddress.deleteMany({
      where: {
        templateId,
        brandAddress: { brandId },
      },
    }),
    ...(requestedIds.length > 0
      ? [
          prisma.templateAddress.createMany({
            data: requestedIds.map((addressId) => ({
              templateId,
              brandAddressId: addressId,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
