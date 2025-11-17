import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandsForUser } from "@/lib/brand-access";
import { getBrandResources } from "@/lib/brand-resources";
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign";
import { getUserOrderProfile } from "@/lib/user-order-profile";

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
        select: {
          brandId: true,
          name: true,
          email: true,
          jobTitle: true,
          mobilePhone: true,
          businessPhone: true,
        },
      })
    : Promise.resolve(null);

  const dbUser = await userPromise;
  let preferredBrandId = dbUser?.brandId ?? session.user.brandId ?? null;

  const normalizedEmail = dbUser?.email ?? session.user.email ?? null;
  if (!preferredBrandId && normalizedEmail) {
    const ensured = await ensureBrandAssignmentForUser({
      userId,
      email: normalizedEmail,
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

  const initialBrandProfile = initialBrandId
    ? await getUserOrderProfile(userId, initialBrandId)
    : null;

  const initialProfile = {
    name: dbUser?.name ?? session.user.name ?? null,
    jobTitle: dbUser?.jobTitle ?? session.user.jobTitle ?? null,
    email: normalizedEmail,
    businessPhone: dbUser?.businessPhone ?? session.user.businessPhone ?? null,
    mobilePhone: dbUser?.mobilePhone ?? session.user.mobilePhone ?? null,
    url: session.user.url ?? null,
  };

  return (
    <OrderForm
      availableBrands={brandOptions}
      initialBrandId={initialBrandId}
      initialTemplateSummaries={templates}
      initialTemplate={initialTemplate}
      initialTemplateKey={initialTemplateKey}
      initialAddresses={normalizedAddresses}
      initialProfile={initialProfile}
      initialBrandProfile={initialBrandProfile}
    />
  );
}
