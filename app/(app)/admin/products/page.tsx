import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminProductsView } from "@/components/admin/products/AdminProductsClient"

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  const params = await searchParams
  return <AdminProductsView autoOpen={params.new === "1"} />
}
