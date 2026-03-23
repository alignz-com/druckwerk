import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return null
  return session
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { templateId } = await params
  const body = await req.json()

  await prisma.template.update({
    where: { id: templateId },
    data: { spotColors: body.spotColors },
  })

  return NextResponse.json({ success: true })
}
