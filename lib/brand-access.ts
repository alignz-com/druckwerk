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
};

export async function getBrandsForUser({
  userId,
  role,
  knownBrandId,
  additionalBrandIds,
}: GetBrandsForUserParams): Promise<BrandOption[]> {
  if (role === "ADMIN" || role === "PRINTER") {
    return prisma.brand.findMany({
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
    where: { id: { in: Array.from(candidateIds) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
