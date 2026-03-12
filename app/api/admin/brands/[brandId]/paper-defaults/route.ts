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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { brandId } = await params
  const rows = await prisma.brandProductPaper.findMany({
    where: { brandId },
    include: {
      product: { select: { id: true, name: true } },
      paperStock: { select: { id: true, name: true, weightGsm: true, finish: true } },
    },
  })
  return NextResponse.json(rows.map((r) => ({
    productId: r.productId,
    productName: r.product.name,
    paperStockId: r.paperStockId,
    paperStockName: r.paperStock.name,
    paperStockDetail: [r.paperStock.weightGsm ? `${r.paperStock.weightGsm}gsm` : null, r.paperStock.finish].filter(Boolean).join(" "),
  })))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { brandId } = await params
  const { defaults } = z.object({
    defaults: z.array(z.object({
      productId: z.string(),
      paperStockId: z.string(),
    })),
  }).parse(await req.json())

  await prisma.$transaction([
    prisma.brandProductPaper.deleteMany({ where: { brandId } }),
    ...(defaults.length > 0
      ? [prisma.brandProductPaper.createMany({
          data: defaults.map((d) => ({ brandId, productId: d.productId, paperStockId: d.paperStockId })),
          skipDuplicates: true,
        })]
      : []),
  ])

  return NextResponse.json({ ok: true })
}
