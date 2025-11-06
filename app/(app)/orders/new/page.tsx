import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTemplatesForBrand } from "@/lib/templates";

export default async function NewOrderPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { brandId: true },
      })
    : null;
  const effectiveBrandId = dbUser?.brandId ?? session.user.brandId ?? null;
  const templates = await listTemplatesForBrand(effectiveBrandId);
  const addresses =
    effectiveBrandId
      ? await prisma.brandAddress.findMany({
          where: { brandId: effectiveBrandId },
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
            url: true,
          },
        })
      : [];

  const normalizedAddresses = addresses.map((address) => ({
    id: address.id,
    label: address.label,
    company: address.company,
    street: address.street,
    addressExtra: address.addressExtra,
    postalCode: address.postalCode,
    city: address.city,
    countryCode: address.countryCode,
    url: address.url,
  }));

  return <OrderForm templates={templates} addresses={normalizedAddresses} />;
}
