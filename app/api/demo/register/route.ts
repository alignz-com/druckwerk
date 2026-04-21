import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

const DEMO_PASSWORD = "demo-tour-2024"

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { name, email } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // Find the Thurnher brand
    const brand = await prisma.brand.findFirst({
      where: { name: { contains: "Thurnher", mode: "insensitive" } },
      select: { id: true },
    })

    if (!brand) {
      return NextResponse.json(
        { error: "Demo brand not configured" },
        { status: 500 },
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isDemo: true },
    })

    // Refuse to overwrite a real (non-demo) user
    if (existing && !existing.isDemo) {
      return NextResponse.json(
        { error: "This email is already registered. Please use the regular login." },
        { status: 409 },
      )
    }

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10)

    let user
    if (existing) {
      // Update existing demo user
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { name, hashedPassword, brandId: brand.id },
      })
    } else {
      // Create new demo user
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name,
          isDemo: true,
          hashedPassword,
          brandId: brand.id,
          role: "USER",
        },
      })
    }

    // Return credentials for client-side signIn()
    return NextResponse.json({
      ok: true,
      email: user.email,
      password: DEMO_PASSWORD,
    })
  } catch (err: any) {
    console.error("[demo/register] error:", err)
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    )
  }
}
