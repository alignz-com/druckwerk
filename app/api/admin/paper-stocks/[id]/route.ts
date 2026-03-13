import { NextRequest, NextResponse } from "next/server"
import { getServerAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await getServerAuthSession()
  if (!session || session.user.role !== "ADMIN") return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  if (name !== undefined && !name) return NextResponse.json({ error: "name must not be empty" }, { status: 400 })
  const stock = await prisma.paperStock.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.finish !== undefined && { finish: body.finish || null }),
      ...(body.color !== undefined && { color: body.color || null }),
      ...(body.weightGsm !== undefined && {
        weightGsm: body.weightGsm ? parseInt(body.weightGsm) : null,
      }),
    },
  })
  return NextResponse.json(stock)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.paperStock.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
