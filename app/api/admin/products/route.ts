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

const bodySchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().nullable().optional(),
  nameDe: z.string().nullable().optional(),
  description: z.string().nullable().optional().default(""),
  type: z.enum(["TEMPLATE", "UPLOAD"]).optional().default("UPLOAD"),
})

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const products = await prisma.product.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { productFormats: true } },
    },
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = bodySchema.parse(await req.json())
  const product = await prisma.product.create({
    data: {
      name: body.name,
      nameEn: body.nameEn ?? null,
      nameDe: body.nameDe ?? null,
      description: body.description || null,
      type: body.type,
      trimWidthMm: null,
      trimHeightMm: null,
      toleranceMm: null,
    },
  })
  return NextResponse.json(product, { status: 201 })
}
