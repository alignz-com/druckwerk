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
  papers: z.array(z.object({
    paperStockId: z.string(),
    role: z.enum(["cover", "content"]).nullable().optional(),
    isDefault: z.boolean().optional(),
  })),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const papers = await prisma.productFormatPaper.findMany({
    where: { productFormatId: id },
    include: { paperStock: true },
    orderBy: [{ role: "asc" }, { paperStock: { name: "asc" } }],
  })
  return NextResponse.json(papers)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { papers } = putSchema.parse(await req.json())
  await prisma.$transaction([
    prisma.productFormatPaper.deleteMany({ where: { productFormatId: id } }),
    prisma.productFormatPaper.createMany({
      data: papers.map((p) => ({
        productFormatId: id,
        paperStockId: p.paperStockId,
        role: p.role ?? null,
        isDefault: p.isDefault ?? false,
      })),
    }),
  ])
  const updated = await prisma.productFormatPaper.findMany({
    where: { productFormatId: id },
    include: { paperStock: true },
    orderBy: [{ role: "asc" }, { paperStock: { name: "asc" } }],
  })
  return NextResponse.json(updated)
}
