import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return null
  return session
}

const bodySchema = z.object({
  newPassword: z.string().min(8),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  const body = bodySchema.safeParse(await req.json())

  if (!body.success) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, accounts: { select: { provider: true } } },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const isAzureAd = user.accounts.some((a) => a.provider === "azure-ad")
  if (isAzureAd) {
    return NextResponse.json({ error: "Cannot set password for Azure AD users" }, { status: 400 })
  }

  const hashed = await bcrypt.hash(body.data.newPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword: hashed },
  })

  return NextResponse.json({ success: true })
}
