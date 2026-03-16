import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminFinishesClient } from "@/components/admin/finishes/AdminFinishesClient"

export default async function AdminFinishesPage() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  return <AdminFinishesClient />
}
