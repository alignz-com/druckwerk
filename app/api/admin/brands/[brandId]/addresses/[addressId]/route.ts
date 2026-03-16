import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminBrand } from "@/lib/admin/brands-data";

type RouteParams = { brandId: string; addressId: string };

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

const addressSchema = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  addressExtra: z.string().trim().max(200).optional().nullable(),
  postalCode: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  countryCode: z.string().trim().max(2).optional().nullable(),
  cardAddressText: z.string().trim().max(1000).optional().nullable(),
  url: z.string().trim().max(200).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId, addressId } = await params;

  const address = await prisma.brandAddress.findUnique({
    where: { id: addressId },
    select: { id: true, brandId: true },
  });

  if (!address || address.brandId !== brandId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body;
  try {
    body = addressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.brandAddress.update({
    where: { id: addressId },
    data: {
      label: body.label ?? null,
      company: body.company ?? null,
      street: body.street ?? null,
      addressExtra: body.addressExtra ?? null,
      postalCode: body.postalCode ?? null,
      city: body.city ?? null,
      countryCode: body.countryCode ?? null,
      cardAddressText: body.cardAddressText ?? null,
      url: body.url ?? null,
    },
  });

  const brand = await getAdminBrand(brandId);
  return NextResponse.json({ brand });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId, addressId } = await params;

  const address = await prisma.brandAddress.findUnique({
    where: { id: addressId },
    select: { id: true, brandId: true },
  });

  if (!address || address.brandId !== brandId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.brandAddress.delete({ where: { id: addressId } });

  const brand = await getAdminBrand(brandId);
  return NextResponse.json({ brand });
}
