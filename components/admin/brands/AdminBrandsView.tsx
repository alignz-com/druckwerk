import { getAdminBrands } from "@/lib/admin/brands-data";

import AdminBrandsClient from "./AdminBrandsClient";

export default async function AdminBrandsView() {
  const brands = await getAdminBrands();
  return <AdminBrandsClient brands={brands} />;
}
