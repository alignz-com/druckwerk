import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TemplateNewPage from "@/components/admin/templates/TemplateNewPage";

export default async function AdminTemplateNewPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  const brands = await prisma.brand.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return <TemplateNewPage brandOptions={brands} />;
}
