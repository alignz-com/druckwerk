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
  nameDe: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  trimWidthMm: z.number().positive().optional(),
  trimHeightMm: z.number().positive().optional(),
  defaultBleedMm: z.number().nonnegative().optional(),
  toleranceMm: z.number().nonnegative().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = bodySchema.parse(await req.json())
  const format = await prisma.format.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.nameDe !== undefined && { nameDe: body.nameDe }),
      ...(body.slug !== undefined && { slug: body.slug }),
      ...(body.trimWidthMm !== undefined && { trimWidthMm: body.trimWidthMm }),
      ...(body.trimHeightMm !== undefined && { trimHeightMm: body.trimHeightMm }),
      ...(body.defaultBleedMm !== undefined && { defaultBleedMm: body.defaultBleedMm }),
      ...(body.toleranceMm !== undefined && { toleranceMm: body.toleranceMm }),
    },
  })
  return NextResponse.json(format)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const inUse = await prisma.productFormat.count({ where: { formatId: id } })
  if (inUse > 0) {
    return NextResponse.json({ error: "Format is in use by product variants" }, { status: 409 })
  }
  await prisma.format.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
