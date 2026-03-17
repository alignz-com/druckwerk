import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TemplateNewPage from "@/components/admin/templates/TemplateNewPage";

export default async function AdminTemplateNewPage() {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <TemplateNewPage />;
}
