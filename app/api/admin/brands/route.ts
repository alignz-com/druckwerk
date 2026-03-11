import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminBrands, getAdminBrand } from "@/lib/admin/brands-data";
import { brandSchema, ensureUniqueSlug, slugify, BrandPayload } from "./util";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const brands = await getAdminBrands();
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: BrandPayload;
  try {
    const json = await req.json();
    payload = brandSchema.parse(json);
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const baseSlug = slugify(payload.slug ?? payload.name);
  const uniqueSlug = await ensureUniqueSlug(baseSlug);

  const brand = await prisma.brand.create({
    data: {
      name: payload.name,
      slug: uniqueSlug,
      contactName: payload.contactName ?? null,
      contactEmail: payload.contactEmail ?? null,
      contactPhone: payload.contactPhone ?? null,
      logoUrl: payload.logoUrl ?? null,
      qrMode: payload.qrMode ?? "VCARD_ONLY",
      defaultQrMode: payload.defaultQrMode ?? null,
      quantityMin: payload.quantityMin ?? null,
      quantityMax: payload.quantityMax ?? null,
      quantityStep: payload.quantityStep ?? null,
      quantityOptions: payload.quantityOptions ?? [],
      addresses: payload.addresses
        ? {
            create: payload.addresses.map((addr) => ({
              label: addr.label ?? null,
              company: addr.company ?? null,
              street: addr.street ?? null,
              addressExtra: addr.addressExtra ?? null,
              postalCode: addr.postalCode ?? null,
              city: addr.city ?? null,
              countryCode: addr.countryCode ?? null,
              cardAddressText: addr.cardAddressText ?? null,
              url: addr.url ?? null,
            })),
          }
        : undefined,
    },
  });

  const summary = await getAdminBrand(brand.id);

  return NextResponse.json({ brandId: brand.id, brand: summary }, { status: 201 });
}
