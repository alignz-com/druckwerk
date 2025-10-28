import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export default async function AdminBrandsPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Brands</h1>
      <p className="text-sm text-slate-500">
        Admin tooling will live here. We will add brand management, template assignments, and user provisioning in the next
        iteration.
      </p>
    </div>
  );
}
