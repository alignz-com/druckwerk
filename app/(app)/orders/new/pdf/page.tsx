import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBrandsForUser } from "@/lib/brand-access"
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign"
import { PdfOrderForm } from "@/components/order/pdf-order-form"
import type { ProductForMatching } from "@/lib/product-matching"

export default async function NewPdfOrderPage() {
  const session = await getServerAuthSession()
  if (!session) redirect("/login")

  const userId = session.user.id
  if (!userId) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { brandId: true, email: true },
  })

  let preferredBrandId = dbUser?.brandId ?? session.user.brandId ?? null
  const email = dbUser?.email ?? session.user.email ?? null

  if (!preferredBrandId && email) {
    const ensured = await ensureBrandAssignmentForUser({ userId, email })
    if (ensured) preferredBrandId = ensured
  }

  const brandOptions = await getBrandsForUser({
    userId,
    role: session.user.role ?? "USER",
    knownBrandId: preferredBrandId,
  })

  let initialBrandId: string | null = null
  if (preferredBrandId && brandOptions.some((b) => b.id === preferredBrandId)) {
    initialBrandId = preferredBrandId
  } else if (brandOptions.length === 1) {
    initialBrandId = brandOptions[0]!.id
  }

  const products: ProductForMatching[] = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      nameEn: true,
      nameDe: true,
      trimWidthMm: true,
      trimHeightMm: true,
      toleranceMm: true,
      minPages: true,
      maxPages: true,
    },
    orderBy: { name: "asc" },
  })

  return (
    <PdfOrderForm
      availableBrands={brandOptions}
      initialBrandId={initialBrandId}
      products={products}
    />
  )
}
