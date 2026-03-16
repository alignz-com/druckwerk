import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminFormatsView } from "@/components/admin/formats/AdminFormatsView"

export default async function AdminFormatsPage() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  return <AdminFormatsView />
}
