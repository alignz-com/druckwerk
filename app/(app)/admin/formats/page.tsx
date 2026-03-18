import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminFormatsView } from "@/components/admin/formats/AdminFormatsClient"

export default async function AdminFormatsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")

  const [formats, params] = await Promise.all([
    prisma.format.findMany({
      orderBy: [{ name: "asc" }],
      include: { _count: { select: { productFormats: true } } },
    }),
    searchParams,
  ])

  return <AdminFormatsView initialFormats={formats} autoOpen={params.new === "1"} />
}
