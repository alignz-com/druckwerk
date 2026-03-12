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
  description: z.string().optional().default(""),
  type: z.enum(["BUSINESS_CARD", "PDF_PRINT"]),
  trimWidthMm: z.number().positive(),
  trimHeightMm: z.number().positive(),
  toleranceMm: z.number().nonnegative().default(1.0),
  expectedBleedMm: z.number().nonnegative().nullable().optional(),
  canvasWidthMm: z.number().positive().nullable().optional(),
  canvasHeightMm: z.number().positive().nullable().optional(),
  printDpi: z.number().int().positive().nullable().optional(),
  pcmCode: z.string().nullable().optional(),
})

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const products = await prisma.product.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { pdfOrderItems: true } },
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
      description: body.description || null,
      type: body.type,
      trimWidthMm: body.trimWidthMm,
      trimHeightMm: body.trimHeightMm,
      toleranceMm: body.toleranceMm,
      expectedBleedMm: body.expectedBleedMm ?? null,
      canvasWidthMm: body.canvasWidthMm ?? null,
      canvasHeightMm: body.canvasHeightMm ?? null,
      printDpi: body.printDpi ?? null,
      pcmCode: body.pcmCode ?? null,
    },
  })
  return NextResponse.json(product, { status: 201 })
}
