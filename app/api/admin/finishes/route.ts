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
  nameDe: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
})

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const finishes = await prisma.finish.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(finishes)
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = bodySchema.parse(await req.json())
  const finish = await prisma.finish.create({
    data: { name: body.name, nameDe: body.nameDe ?? null, code: body.code ?? null },
  })
  return NextResponse.json(finish, { status: 201 })
}
