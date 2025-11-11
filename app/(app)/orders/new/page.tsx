import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateByKey, listTemplateSummariesForBrand } from "@/lib/templates";
import { getBrandsForUser } from "@/lib/brand-access";

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
  const preferredBrandId = dbUser?.brandId ?? session.user.brandId ?? null;

  const brandOptions = await getBrandsForUser({
    userId,
    role: session.user.role ?? "USER",
    knownBrandId: preferredBrandId,
  });

  const initialBrandId =
    brandOptions.find((brand) => brand.id === preferredBrandId)?.id ??
    brandOptions[0]?.id ??
    preferredBrandId ??
    null;

  const templatesPromise = listTemplateSummariesForBrand(initialBrandId);
  const addressesPromise = initialBrandId
    ? prisma.brandAddress.findMany({
        where: { brandId: initialBrandId },
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
      })
    : Promise.resolve([]);

  const [templates, addresses] = await Promise.all([templatesPromise, addressesPromise]);
  const initialTemplate =
    templates[0]?.key && initialBrandId !== undefined
      ? await getTemplateByKey(templates[0]!.key, initialBrandId ?? null)
      : null;

  const normalizedAddresses = addresses.map((address) => ({
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

  return (
    <OrderForm
      availableBrands={brandOptions}
      initialBrandId={initialBrandId}
      initialTemplateSummaries={templates}
      initialTemplate={initialTemplate}
      initialAddresses={normalizedAddresses}
    />
  );
}
