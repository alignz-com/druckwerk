import { prisma } from "@/lib/prisma";

type EnsureBrandAssignmentParams = {
  userId: string;
  domain?: string | null;
  email?: string | null;
  currentBrandId?: string | null;
  brandIdHint?: string;
};

const normalizeDomain = (value?: string | null) => value?.toLowerCase().trim() ?? "";

const domainFromEmail = (email?: string | null) => {
  if (!email || !email.includes("@")) return "";
  const [, rawDomain] = email.split("@");
  return normalizeDomain(rawDomain);
};

export async function ensureBrandAssignmentForUser({
  userId,
  domain,
  email,
  currentBrandId,
  brandIdHint,
}: EnsureBrandAssignmentParams): Promise<string | null> {
  if (!userId) return currentBrandId ?? null;
  if (currentBrandId) return currentBrandId;

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { brandId: true, email: true },
  });
  if (!userRecord) return null;
  if (userRecord.brandId) return userRecord.brandId;

  // Try domain-based assignment first, fall back to tenant-based hint
  const normalizedDomain = normalizeDomain(domain) || domainFromEmail(email) || domainFromEmail(userRecord.email);
  const brandDomain = normalizedDomain
    ? await prisma.brandDomain.findFirst({ where: { domain: normalizedDomain }, select: { brandId: true } })
    : null;

  const resolvedBrandId = brandDomain?.brandId ?? brandIdHint ?? null;
  if (!resolvedBrandId) return null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { brandId: resolvedBrandId },
    select: { brandId: true },
  });
  return updated.brandId;
}
