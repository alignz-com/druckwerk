import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminPaperStocksClient } from "@/components/admin/papers/AdminPaperStocksClient"

export default async function AdminPapersPage() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  return <AdminPaperStocksClient />
}
