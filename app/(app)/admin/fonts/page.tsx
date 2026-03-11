import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import AdminFontsView from "@/components/admin/fonts/AdminFontsView";

export default async function AdminFontsPage() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  return <AdminFontsView />;
}
