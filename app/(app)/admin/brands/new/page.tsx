import BrandFormPage from "@/components/admin/brands/BrandFormPage";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export default async function AdminBrandNewPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <BrandFormPage brand={null} />;
}
