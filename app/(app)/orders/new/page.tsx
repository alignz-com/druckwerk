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

  return <OrderForm templates={templates} />;
}
