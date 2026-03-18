import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import AdminFontsView from "@/components/admin/fonts/AdminFontsView";

export default async function AdminFontsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }
  const params = await searchParams;
  return <AdminFontsView autoOpen={params.new === "1"} />;
}
