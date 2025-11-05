import BrandDetailClient from "@/components/admin/brands/BrandDetailClient";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export default async function AdminBrandNewPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <BrandDetailClient brand={null} />;
}
