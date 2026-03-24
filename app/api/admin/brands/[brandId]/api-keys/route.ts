import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { randomBytes } from "crypto"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/api-key-auth"

type RouteContext = { params: Promise<{ brandId: string }> }

/** GET — list API keys for a brand (token is never returned) */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { brandId } = await ctx.params

  const keys = await prisma.apiKey.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json(keys)
}

/** POST — create a new API key for a brand. Returns the raw token once. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { brandId } = await ctx.params

  const brand = await prisma.brand.findUnique({ where: { id: brandId } })
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" && body.label.trim()
    ? body.label.trim()
    : `${brand.name} API`

  const raw = randomBytes(32).toString("hex")
  const hashed = hashApiKey(raw)

  const apiKey = await prisma.apiKey.create({
    data: {
      key: hashed,
      label,
      brandId,
    },
    select: {
      id: true,
      label: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ...apiKey, token: raw }, { status: 201 })
}

/** PATCH — toggle active/inactive or update label */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { brandId } = await ctx.params
  const body = await req.json()
  const { id, isActive, label } = body as {
    id: string
    isActive?: boolean
    label?: string
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const existing = await prisma.apiKey.findFirst({
    where: { id, brandId },
  })
  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof isActive === "boolean") data.isActive = isActive
  if (typeof label === "string") data.label = label.trim()

  const updated = await prisma.apiKey.update({
    where: { id },
    data,
    select: {
      id: true,
      label: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json(updated)
}

/** DELETE — permanently remove an API key */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { brandId } = await ctx.params
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const existing = await prisma.apiKey.findFirst({
    where: { id, brandId },
  })
  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
