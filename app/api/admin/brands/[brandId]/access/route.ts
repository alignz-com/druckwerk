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
  canUseTemplates: z.boolean(),
  canUploadFiles: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { brandId } = await params
  const body = bodySchema.parse(await req.json())
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: {
      canUseTemplates: body.canUseTemplates,
      canUploadFiles: body.canUploadFiles,
    },
    select: { id: true, canUseTemplates: true, canUploadFiles: true },
  })
  return NextResponse.json(brand)
}
