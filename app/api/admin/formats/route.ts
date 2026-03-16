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

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

const bodySchema = z.object({
  name: z.string().min(1),
  nameDe: z.string().nullable().optional(),
  slug: z.string().optional(),
  trimWidthMm: z.number().positive(),
  trimHeightMm: z.number().positive(),
  defaultBleedMm: z.number().nonnegative().default(3.0),
  toleranceMm: z.number().nonnegative().default(1.0),
})

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const formats = await prisma.format.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { productFormats: true } } },
  })
  return NextResponse.json(formats)
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = bodySchema.parse(await req.json())
  const slug = body.slug?.trim() || slugify(body.name)
  const format = await prisma.format.create({
    data: {
      name: body.name,
      nameDe: body.nameDe ?? null,
      slug,
      trimWidthMm: body.trimWidthMm,
      trimHeightMm: body.trimHeightMm,
      defaultBleedMm: body.defaultBleedMm,
      toleranceMm: body.toleranceMm,
    },
  })
  return NextResponse.json(format, { status: 201 })
}
