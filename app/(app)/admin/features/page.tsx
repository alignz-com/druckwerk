import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import AdminFeaturesClient from "@/components/admin/features/AdminFeaturesClient";

export default async function AdminFeaturesPage() {
  const features = await prisma.feature.findMany({
    include: { comments: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <Suspense fallback={null}>
      <AdminFeaturesClient features={features} />
    </Suspense>
  );
}
