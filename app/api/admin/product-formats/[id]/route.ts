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
  formatId: z.string().optional(),
  pcmCode: z.string().nullable().optional(),
  printDpi: z.number().int().positive().nullable().optional(),
  canvasWidthMm: z.number().positive().nullable().optional(),
  canvasHeightMm: z.number().positive().nullable().optional(),
  productionSteps: z.array(z.string()).optional(),
  minPages: z.number().int().positive().nullable().optional(),
  maxPages: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = bodySchema.parse(await req.json())
  const pf = await prisma.productFormat.update({
    where: { id },
    data: {
      ...(body.formatId !== undefined && { formatId: body.formatId }),
      ...(body.pcmCode !== undefined && { pcmCode: body.pcmCode }),
      ...(body.printDpi !== undefined && { printDpi: body.printDpi }),
      ...(body.canvasWidthMm !== undefined && { canvasWidthMm: body.canvasWidthMm }),
      ...(body.canvasHeightMm !== undefined && { canvasHeightMm: body.canvasHeightMm }),
      ...(body.productionSteps !== undefined && { productionSteps: body.productionSteps }),
      ...(body.minPages !== undefined && { minPages: body.minPages }),
      ...(body.maxPages !== undefined && { maxPages: body.maxPages }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { format: true, papers: { include: { paperStock: true } }, finishes: { include: { finish: true } } },
  })
  return NextResponse.json(pf)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.productFormat.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
