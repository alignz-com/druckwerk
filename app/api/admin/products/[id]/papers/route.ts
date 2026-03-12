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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: productId } = await params
  const rows = await prisma.productPaperStock.findMany({
    where: { productId },
    include: { paperStock: true },
    orderBy: { paperStock: { name: "asc" } },
  })
  return NextResponse.json(rows.map((r) => r.paperStock))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: productId } = await params
  const { paperStockIds } = z.object({ paperStockIds: z.array(z.string()) }).parse(await req.json())

  await prisma.$transaction([
    prisma.productPaperStock.deleteMany({ where: { productId } }),
    ...(paperStockIds.length > 0
      ? [prisma.productPaperStock.createMany({
          data: paperStockIds.map((paperStockId) => ({ productId, paperStockId })),
          skipDuplicates: true,
        })]
      : []),
  ])

  return NextResponse.json({ ok: true })
}
