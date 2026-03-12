import { prisma } from "@/lib/prisma"

export type AccessibleProductTypes = {
  hasBusinessCard: boolean
  hasPdfPrint: boolean
}

/**
 * Returns which order types a user can access.
 * Logic:
 * 1. If the user has explicit overrides (non-null), use those.
 * 2. Else use the brand's settings.
 * 3. Else default to business card only (backwards compatibility).
 */
export async function getUserAccessibleProductTypes(
  userId: string,
  brandId: string | null | undefined,
): Promise<AccessibleProductTypes> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      canOrderBusinessCards: true,
      canOrderPdfPrint: true,
      brand: brandId
        ? { select: { canOrderBusinessCards: true, canOrderPdfPrint: true } }
        : undefined,
    },
  })

  if (!user) return { hasBusinessCard: true, hasPdfPrint: false }

  // User-level overrides take precedence if set
  const hasUserOverride =
    user.canOrderBusinessCards !== null || user.canOrderPdfPrint !== null

  if (hasUserOverride) {
    return {
      hasBusinessCard: user.canOrderBusinessCards ?? true,
      hasPdfPrint: user.canOrderPdfPrint ?? false,
    }
  }

  // Fall back to brand settings
  if (user.brand) {
    return {
      hasBusinessCard: user.brand.canOrderBusinessCards,
      hasPdfPrint: user.brand.canOrderPdfPrint,
    }
  }

  // Default
  return { hasBusinessCard: true, hasPdfPrint: false }
}
