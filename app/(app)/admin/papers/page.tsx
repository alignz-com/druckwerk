import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminPaperStocksClient } from "@/components/admin/papers/AdminPapersClient"

export default async function AdminPapersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  const params = await searchParams
  return <AdminPaperStocksClient autoOpen={params.new === "1"} />
}
