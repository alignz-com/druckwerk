import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBrandsForUser } from "@/lib/brand-access"
import { ensureBrandAssignmentForUser } from "@/lib/brand-auto-assign"
import { PdfOrderForm } from "@/components/order/pdf-order-form"
import type { ProductFormatForMatching } from "@/lib/product-matching"

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

  const rawFormats = await prisma.productFormat.findMany({
    where: { isActive: true },
    include: {
      product: { select: { id: true, name: true, nameEn: true, nameDe: true } },
      format: { select: { name: true, nameDe: true, trimWidthMm: true, trimHeightMm: true, toleranceMm: true, defaultBleedMm: true } },
    },
    orderBy: { product: { name: "asc" } },
  })

  const products: ProductFormatForMatching[] = rawFormats.map((pf) => ({
    id: pf.id,
    productId: pf.productId,
    productName: pf.product.name,
    productNameEn: pf.product.nameEn,
    productNameDe: pf.product.nameDe,
    formatName: pf.format.name,
    formatNameDe: pf.format.nameDe ?? null,
    trimWidthMm: pf.format.trimWidthMm,
    trimHeightMm: pf.format.trimHeightMm,
    toleranceMm: pf.format.toleranceMm,
    defaultBleedMm: pf.format.defaultBleedMm,
    minPages: pf.minPages,
    maxPages: pf.maxPages,
  }))

  return (
    <PdfOrderForm
      availableBrands={brandOptions}
      initialBrandId={initialBrandId}
      products={products}
      isDemo={session.user.isDemo ?? false}
    />
  )
}
