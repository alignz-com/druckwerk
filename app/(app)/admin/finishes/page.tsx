import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminFinishesClient } from "@/components/admin/finishes/AdminFinishesClient"

export default async function AdminFinishesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")
  const params = await searchParams
  return <AdminFinishesClient autoOpen={params.new === "1"} />
}
