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
  name: z.string().min(1).optional(),
  nameEn: z.string().nullable().optional(),
  nameDe: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  trimWidthMm: z.number().nullable().optional(),
  trimHeightMm: z.number().nullable().optional(),
  canvasWidthMm: z.number().nullable().optional(),
  canvasHeightMm: z.number().nullable().optional(),
  printDpi: z.number().int().nullable().optional(),
  pcmCode: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = bodySchema.parse(await req.json())
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
      ...(body.nameDe !== undefined && { nameDe: body.nameDe }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.trimWidthMm !== undefined && { trimWidthMm: body.trimWidthMm }),
      ...(body.trimHeightMm !== undefined && { trimHeightMm: body.trimHeightMm }),
      ...(body.canvasWidthMm !== undefined && { canvasWidthMm: body.canvasWidthMm }),
      ...(body.canvasHeightMm !== undefined && { canvasHeightMm: body.canvasHeightMm }),
      ...(body.printDpi !== undefined && { printDpi: body.printDpi }),
      ...(body.pcmCode !== undefined && { pcmCode: body.pcmCode }),
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.product.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
