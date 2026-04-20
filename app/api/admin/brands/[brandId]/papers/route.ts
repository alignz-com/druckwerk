import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return null
  return session
}

const putSchema = z.object({
  paperStockIds: z.array(z.string()),
})

// GET — returns the brand's paper whitelist with full PaperStock data
export async function GET(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { brandId } = await params
  const papers = await prisma.brandPaper.findMany({
    where: { brandId },
    include: { paperStock: true },
    orderBy: { paperStock: { name: "asc" } },
  })
  return NextResponse.json(papers)
}

// PUT — replace the entire brand paper whitelist (delete all + create new in transaction)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { brandId } = await params
  const { paperStockIds } = putSchema.parse(await req.json())
  await prisma.$transaction([
    prisma.brandPaper.deleteMany({ where: { brandId } }),
    ...(paperStockIds.length > 0 ? [prisma.brandPaper.createMany({
      data: paperStockIds.map((paperStockId) => ({ brandId, paperStockId })),
    })] : []),
  ])
  const updated = await prisma.brandPaper.findMany({
    where: { brandId },
    include: { paperStock: true },
    orderBy: { paperStock: { name: "asc" } },
  })
  return NextResponse.json(updated)
}
