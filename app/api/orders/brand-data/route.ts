import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getBrandsForUser } from "@/lib/brand-access";
import { getBrandResources } from "@/lib/brand-resources";
import { getUserOrderProfile } from "@/lib/user-order-profile";

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

  const { templates, addresses, initialTemplate, initialTemplateKey, brandId } =
    await getBrandResources(resolvedBrandId);
  const profile = await getUserOrderProfile(session.user.id, resolvedBrandId);

  return NextResponse.json({
    templates,
    addresses,
    initialTemplate,
    initialTemplateKey,
    brandId,
    profile,
  });
}
