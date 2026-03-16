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
  finishes: z.array(z.object({
    finishId: z.string(),
    isDefault: z.boolean().optional(),
  })),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const finishes = await prisma.productFormatFinish.findMany({
    where: { productFormatId: id },
    include: { finish: true },
    orderBy: { finish: { name: "asc" } },
  })
  return NextResponse.json(finishes)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { finishes } = putSchema.parse(await req.json())
  await prisma.$transaction([
    prisma.productFormatFinish.deleteMany({ where: { productFormatId: id } }),
    prisma.productFormatFinish.createMany({
      data: finishes.map((f) => ({
        productFormatId: id,
        finishId: f.finishId,
        isDefault: f.isDefault ?? false,
      })),
    }),
  ])
  const updated = await prisma.productFormatFinish.findMany({
    where: { productFormatId: id },
    include: { finish: true },
    orderBy: { finish: { name: "asc" } },
  })
  return NextResponse.json(updated)
}
