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
  formatId: z.string().min(1),
  pcmCode: z.string().nullable().optional(),
  printDpi: z.number().int().positive().nullable().optional(),
  canvasWidthMm: z.number().positive().nullable().optional(),
  canvasHeightMm: z.number().positive().nullable().optional(),
  productionSteps: z.array(z.string()).optional(),
  minPages: z.number().int().positive().nullable().optional(),
  maxPages: z.number().int().positive().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const formats = await prisma.productFormat.findMany({
    where: { productId: id },
    include: {
      format: true,
      papers: { include: { paperStock: true }, orderBy: [{ role: "asc" }, { paperStock: { name: "asc" } }] },
      finishes: { include: { finish: true }, orderBy: { finish: { name: "asc" } } },
    },
    orderBy: { format: { name: "asc" } },
  })
  return NextResponse.json(formats)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: productId } = await params
  const body = bodySchema.parse(await req.json())

  const existing = await prisma.productFormat.findUnique({
    where: { productId_formatId: { productId, formatId: body.formatId } },
  })
  if (existing) {
    return NextResponse.json({ error: "This format is already assigned to this product" }, { status: 409 })
  }

  const pf = await prisma.productFormat.create({
    data: {
      productId,
      formatId: body.formatId,
      pcmCode: body.pcmCode ?? null,
      printDpi: body.printDpi ?? null,
      canvasWidthMm: body.canvasWidthMm ?? null,
      canvasHeightMm: body.canvasHeightMm ?? null,
      productionSteps: body.productionSteps ?? [],
      minPages: body.minPages ?? null,
      maxPages: body.maxPages ?? null,
    },
    include: {
      format: true,
      papers: { include: { paperStock: true } },
      finishes: { include: { finish: true } },
    },
  })
  return NextResponse.json(pf, { status: 201 })
}
