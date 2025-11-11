import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getBrandsForUser } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { getTemplateByKey, listTemplateSummariesForBrand } from "@/lib/templates";

export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedBrandId = url.searchParams.get("brandId");

  const brandOptions = await getBrandsForUser({
    userId: session.user.id,
    role: session.user.role ?? "USER",
    knownBrandId: session.user.brandId ?? null,
  });

  const resolvedBrandId =
    requestedBrandId && requestedBrandId.trim().length > 0
      ? requestedBrandId
      : brandOptions.length === 1
        ? brandOptions[0].id
        : null;

  if (!resolvedBrandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  if (!brandOptions.some((brand) => brand.id === resolvedBrandId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [templates, addressRecords] = await Promise.all([
    listTemplateSummariesForBrand(resolvedBrandId),
    prisma.brandAddress.findMany({
      where: { brandId: resolvedBrandId },
      orderBy: [{ label: "asc" }, { company: "asc" }],
      select: {
        id: true,
        label: true,
        company: true,
        street: true,
        addressExtra: true,
        postalCode: true,
        city: true,
        countryCode: true,
        cardAddressText: true,
        url: true,
      },
    }),
  ]);

  let initialTemplate = null;
  if (templates[0]?.key) {
    try {
      initialTemplate = await getTemplateByKey(templates[0]!.key, resolvedBrandId);
    } catch (error) {
      console.warn("[orders] failed to preload template for brand", resolvedBrandId, error);
    }
  }

  const addresses = addressRecords.map((address) => ({
    id: address.id,
    label: address.label,
    company: address.company,
    street: address.street,
    addressExtra: address.addressExtra,
    postalCode: address.postalCode,
    city: address.city,
    countryCode: address.countryCode,
    cardAddressText: address.cardAddressText,
    url: address.url,
  }));

  return NextResponse.json({
    templates,
    addresses,
    initialTemplate,
  });
}
