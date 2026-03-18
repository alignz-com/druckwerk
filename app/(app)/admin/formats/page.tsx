import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminFormatsView } from "@/components/admin/formats/AdminFormatsView"

export default async function AdminFormatsPage() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") redirect("/orders")

  const formats = await prisma.format.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { productFormats: true } } },
  })

  return <AdminFormatsView initialFormats={formats} />
}
