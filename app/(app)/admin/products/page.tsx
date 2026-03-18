import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminProductsView } from "@/components/admin/products/AdminProductsClient"

export default async function AdminProductsPage() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  return <AdminProductsView />
}
