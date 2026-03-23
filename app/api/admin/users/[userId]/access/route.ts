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

// null means "inherit from brand"
const bodySchema = z.object({
  canUseTemplates: z.boolean().nullable(),
  canUploadFiles: z.boolean().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { userId } = await params
  const body = bodySchema.parse(await req.json())
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      canUseTemplates: body.canUseTemplates,
      canUploadFiles: body.canUploadFiles,
    },
    select: { id: true, canUseTemplates: true, canUploadFiles: true },
  })
  return NextResponse.json(user)
}
