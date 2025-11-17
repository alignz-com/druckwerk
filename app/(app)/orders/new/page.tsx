import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandsForUser } from "@/lib/brand-access";
import { getBrandResources } from "@/lib/brand-resources";
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign";

export default async function NewOrderPage() {
  const sessionPromise = getServerAuthSession();
  const session = await sessionPromise;
  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  if (!userId) {
    redirect("/login");
  }
  const userPromise = userId
    ? prisma.user.findUnique({
        where: { id: userId },
        select: { brandId: true },
      })
    : Promise.resolve(null);

  const dbUser = await userPromise;
  let preferredBrandId = dbUser?.brandId ?? session.user.brandId ?? null;

  if (!preferredBrandId && session.user.email) {
    const ensured = await ensureBrandAssignmentForUser({
      userId,
      email: session.user.email,
    });
    if (ensured) {
      preferredBrandId = ensured;
      session.user.brandId = ensured;
    }
  }

  const brandOptions = await getBrandsForUser({
    userId,
    role: session.user.role ?? "USER",
    knownBrandId: preferredBrandId,
  });

  let initialBrandId: string | null = null;
  if (preferredBrandId && brandOptions.some((brand) => brand.id === preferredBrandId)) {
    initialBrandId = preferredBrandId;
  } else if (brandOptions.length === 1) {
    initialBrandId = brandOptions[0]!.id;
  }

  const {
    templates,
    addresses: normalizedAddresses,
    initialTemplate,
    initialTemplateKey,
  } = await getBrandResources(initialBrandId ?? null);

  return (
    <OrderForm
      availableBrands={brandOptions}
      initialBrandId={initialBrandId}
      initialTemplateSummaries={templates}
      initialTemplate={initialTemplate}
      initialTemplateKey={initialTemplateKey}
      initialAddresses={normalizedAddresses}
    />
  );
}
