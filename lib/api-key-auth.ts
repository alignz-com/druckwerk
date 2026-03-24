import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export async function authenticateApiKey(request: Request) {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null

  const raw = header.slice(7).trim()
  if (!raw) return null

  const hashed = hashApiKey(raw)

  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashed },
    include: { brand: true },
  })

  if (!apiKey || !apiKey.isActive) return null

  // Update lastUsedAt (fire-and-forget)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return apiKey
}
