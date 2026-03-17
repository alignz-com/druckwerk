import BrandFormPage from "@/components/admin/brands/BrandFormPage";
import { getAdminBrand } from "@/lib/admin/brands-data";
import { getServerAuthSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

type RouteParams = {
  brandId: string;
};

export default async function AdminBrandDetailPage({
  params,
}: {
  params: RouteParams | Promise<RouteParams>;
}) {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  const resolvedParams = await Promise.resolve(params);
  const brandId = resolvedParams?.brandId;

  if (!brandId) {
    notFound();
  }

  const brand = await getAdminBrand(brandId);

  if (!brand) {
    notFound();
  }

  return <BrandFormPage brand={brand} />;
}
