import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { AdminSettingsForm } from "@/components/admin/settings/AdminSettingsForm";

export default async function AdminSettingsPage() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") redirect("/orders");
  return <AdminSettingsForm />;
}
