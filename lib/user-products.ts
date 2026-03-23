import { prisma } from "@/lib/prisma"

export type AccessibleWorkflows = {
  hasTemplate: boolean
  hasUpload: boolean
}

/**
 * Returns which order workflows a user can access.
 * Logic:
 * 1. If the user has explicit overrides (non-null), use those.
 * 2. Else use the brand's settings.
 * 3. Else default to template only (backwards compatibility).
 */
export async function getUserAccessibleWorkflows(
  userId: string,
  brandId: string | null | undefined,
): Promise<AccessibleWorkflows> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      canUseTemplates: true,
      canUploadFiles: true,
      brand: brandId
        ? { select: { canUseTemplates: true, canUploadFiles: true } }
        : undefined,
    },
  })

  if (!user) return { hasTemplate: true, hasUpload: false }

  // User-level overrides take precedence if set
  const hasUserOverride =
    user.canUseTemplates !== null || user.canUploadFiles !== null

  if (hasUserOverride) {
    return {
      hasTemplate: user.canUseTemplates ?? true,
      hasUpload: user.canUploadFiles ?? false,
    }
  }

  // Fall back to brand settings
  if (user.brand) {
    return {
      hasTemplate: user.brand.canUseTemplates,
      hasUpload: user.brand.canUploadFiles,
    }
  }

  // Default
  return { hasTemplate: true, hasUpload: false }
}
