import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type BrandOption = {
  id: string;
  name: string;
};

type GetBrandsForUserParams = {
  userId: string;
  role: UserRole | string;
  knownBrandId?: string | null;
  additionalBrandIds?: string[] | null;
  /** Only return brands that have at least one template assigned */
  requireTemplates?: boolean;
};

export async function getBrandsForUser({
  userId,
  role,
  knownBrandId,
  additionalBrandIds,
  requireTemplates,
}: GetBrandsForUserParams): Promise<BrandOption[]> {
  const templateFilter = requireTemplates ? { templates: { some: {} } } : {};

  if (role === "ADMIN" || role === "PRINTER") {
    return prisma.brand.findMany({
      where: templateFilter,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  const candidateIds = new Set<string>();
  if (knownBrandId) candidateIds.add(knownBrandId);
  if (additionalBrandIds) {
    for (const brandId of additionalBrandIds) {
      if (brandId) candidateIds.add(brandId);
    }
  }

  if (candidateIds.size === 0) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { brandId: true },
    });
    if (userRecord?.brandId) {
      candidateIds.add(userRecord.brandId);
    }
  }

  if (candidateIds.size === 0) {
    return [];
  }

  return prisma.brand.findMany({
    where: { id: { in: Array.from(candidateIds) }, ...templateFilter },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
