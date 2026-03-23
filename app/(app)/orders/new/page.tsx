import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandsForUser } from "@/lib/brand-access";
import { getBrandResources } from "@/lib/brand-resources";
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign";
import { getUserOrderProfile } from "@/lib/user-order-profile";
import { getUserAccessibleWorkflows } from "@/lib/user-products";
import { OrderTypeSelector } from "@/components/order/OrderTypeSelector";

export default async function NewOrderPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const userId = session.user.id;
  if (!userId) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      brandId: true,
      name: true,
      email: true,
      jobTitle: true,
      mobilePhone: true,
      businessPhone: true,
      isDemo: true,
    },
  });

  let preferredBrandId = dbUser?.brandId ?? session.user.brandId ?? null;
  const normalizedEmail = dbUser?.email ?? session.user.email ?? null;

  if (!preferredBrandId && normalizedEmail) {
    const ensured = await ensureBrandAssignmentForUser({ userId, email: normalizedEmail });
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
  if (preferredBrandId && brandOptions.some((b) => b.id === preferredBrandId)) {
    initialBrandId = preferredBrandId;
  } else if (brandOptions.length === 1) {
    initialBrandId = brandOptions[0]!.id;
  }

  const resolvedBrandId = initialBrandId ?? preferredBrandId;
  const [access, brandTemplateCount] = await Promise.all([
    getUserAccessibleWorkflows(userId, resolvedBrandId),
    resolvedBrandId
      ? prisma.brandTemplate.count({ where: { brandId: resolvedBrandId } })
      : Promise.resolve(0),
  ]);

  // If the brand has no templates, treat template access as unavailable
  const hasTemplate = access.hasTemplate && brandTemplateCount > 0;

  if (access.hasUpload && !hasTemplate) {
    redirect("/orders/new/pdf");
  }

  if (hasTemplate && access.hasUpload) {
    return <OrderTypeSelector />;
  }

  const {
    templates,
    addresses: normalizedAddresses,
    initialTemplate,
    initialTemplateKey,
    qrMode,
    defaultQrMode,
    quantityMin,
    quantityMax,
    quantityStep,
    quantityOptions,
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
      initialBrandQrMode={qrMode}
      initialBrandDefaultQrMode={defaultQrMode}
      initialBrandQuantityMin={quantityMin}
      initialBrandQuantityMax={quantityMax}
      initialBrandQuantityStep={quantityStep}
      initialBrandQuantityOptions={quantityOptions}
      initialProfile={initialProfile}
      initialBrandProfile={initialBrandProfile}
      isDemo={dbUser?.isDemo ?? false}
    />
  );
}
