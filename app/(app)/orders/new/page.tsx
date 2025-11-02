import { redirect } from "next/navigation";

import OrderForm from "@/components/order/order-form";
import { getServerAuthSession } from "@/lib/auth";
import { listTemplatesForBrand } from "@/lib/templates";

export default async function NewOrderPage() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/login");
  }

  const templates = await listTemplatesForBrand(session.user.brandId ?? null);

  return <OrderForm templates={templates} />;
}
