"use server";

import { Suspense } from "react";

import { getAdminUsers } from "@/lib/admin/users-data";
import { getAdminBrands } from "@/lib/admin/brands-data";

import AdminUsersClient from "./AdminUsersClient";

export default async function AdminUsersView() {
  const [users, brands] = await Promise.all([getAdminUsers(), getAdminBrands()]);

  const brandOptions = brands
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Suspense fallback={null}>
      <AdminUsersClient
        users={users}
        brands={brandOptions}
      />
    </Suspense>
  );
}
