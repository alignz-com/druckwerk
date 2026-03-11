import AdminBrandsView from "@/components/admin/brands/AdminBrandsView";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export default async function AdminBrandsPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <AdminBrandsView />;
}
