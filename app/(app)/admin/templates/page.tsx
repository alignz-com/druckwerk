import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import AdminTemplatesView from "@/components/admin/templates/AdminTemplatesView";

export default async function AdminTemplatesPage() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <AdminTemplatesView />;
}
