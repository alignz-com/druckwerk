import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brandSchema, ensureUniqueSlug, slugify } from "../util";
import { getAdminBrand } from "@/lib/admin/brands-data";

const brandUpdateSchema = brandSchema.extend({
  name: brandSchema.shape.name.optional(),
});

type RouteParams = { brandId: string };

async function resolveParams(context: { params: RouteParams | Promise<RouteParams> }): Promise<RouteParams> {
  const params = await Promise.resolve(context.params);
  if (!params?.brandId) {
    throw new Error("Missing route parameter: brandId");
  }
  return params;
}

export async function GET(_req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);
  const brand = await getAdminBrand(brandId);
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ brand });
}

export async function PATCH(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);
  const existingBrand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!existingBrand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload;
  try {
    const json = await req.json();
    payload = brandUpdateSchema.parse(json);
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const targetName = payload.name ?? existingBrand.name;
  const requestedSlug = payload.slug ?? existingBrand.slug ?? slugify(targetName);
  const baseSlug = slugify(requestedSlug || targetName);
  const uniqueSlug = await ensureUniqueSlug(baseSlug, brandId);

  const addresses = payload.addresses;
  const quantityMin = Object.prototype.hasOwnProperty.call(payload, "quantityMin")
    ? payload.quantityMin ?? null
    : existingBrand.quantityMin;
  const quantityMax = Object.prototype.hasOwnProperty.call(payload, "quantityMax")
    ? payload.quantityMax ?? null
    : existingBrand.quantityMax;
  const quantityStep = Object.prototype.hasOwnProperty.call(payload, "quantityStep")
    ? payload.quantityStep ?? null
    : existingBrand.quantityStep;
  const quantityOptions = Object.prototype.hasOwnProperty.call(payload, "quantityOptions")
    ? payload.quantityOptions ?? []
    : existingBrand.quantityOptions;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id: brandId },
        data: {
          name: targetName,
          slug: uniqueSlug,
          contactName: payload.contactName ?? null,
          contactEmail: payload.contactEmail ?? null,
          contactPhone: payload.contactPhone ?? null,
          logoUrl: payload.logoUrl ?? null,
          qrMode: payload.qrMode ?? existingBrand.qrMode,
          defaultQrMode: payload.defaultQrMode ?? existingBrand.defaultQrMode,
          quantityMin,
          quantityMax,
          quantityStep,
          quantityOptions,
        },
      });

      if (addresses) {
        const existingAddresses = await tx.brandAddress.findMany({
          where: { brandId },
          select: { id: true },
        });
        const existingIds = new Set(existingAddresses.map((addr) => addr.id));
        const incomingIds = new Set(addresses.filter((addr) => addr.id).map((addr) => addr.id as string));

        for (const incomingId of incomingIds) {
          if (!existingIds.has(incomingId)) {
            throw new Error("ADDRESS_NOT_OWNED");
          }
        }

        const deleteIds = [...existingIds].filter((id) => !incomingIds.has(id));
        if (deleteIds.length > 0) {
          await tx.brandAddress.deleteMany({ where: { id: { in: deleteIds } } });
        }

        for (const address of addresses) {
          const data = {
            label: address.label ?? null,
            company: address.company ?? null,
            street: address.street ?? null,
            addressExtra: address.addressExtra ?? null,
            postalCode: address.postalCode ?? null,
            city: address.city ?? null,
            countryCode: address.countryCode ?? null,
            cardAddressText: address.cardAddressText ?? null,
            url: address.url ?? null,
          };

          if (address.id) {
            await tx.brandAddress.update({ where: { id: address.id }, data });
          } else {
            await tx.brandAddress.create({ data: { ...data, brandId } });
          }
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_NOT_OWNED") {
      return NextResponse.json({ error: "Address does not belong to brand" }, { status: 400 });
    }
    console.error("[admin] update brand failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const brand = await getAdminBrand(brandId);

  return NextResponse.json({ brand });
}

export async function DELETE(_req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { brandId } = await resolveParams(context);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      orders: { select: { id: true } },
      templates: { select: { id: true } },
    },
  });

  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (brand.orders.length > 0 || brand.templates.length > 0) {
    return NextResponse.json(
      { error: "Brand cannot be deleted while orders or templates are linked." },
      { status: 409 },
    );
  }

  await prisma.brand.delete({ where: { id: brandId } });

  return NextResponse.json({ success: true });
}
