import { prisma } from "@/lib/prisma";

type EnsureBrandAssignmentParams = {
  userId: string;
  domain?: string | null;
  email?: string | null;
  currentBrandId?: string | null;
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
}: EnsureBrandAssignmentParams): Promise<string | null> {
  if (!userId) return currentBrandId ?? null;
  if (currentBrandId) return currentBrandId;

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { brandId: true, email: true },
  });
  if (!userRecord) return null;
  if (userRecord.brandId) return userRecord.brandId;

  const normalizedDomain = normalizeDomain(domain) || domainFromEmail(email) || domainFromEmail(userRecord.email);
  if (!normalizedDomain) {
    return null;
  }

  const brandDomain = await prisma.brandDomain.findFirst({
    where: { domain: normalizedDomain },
    select: { brandId: true },
  });
  if (!brandDomain?.brandId) {
    return null;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { brandId: brandDomain.brandId },
    select: { brandId: true },
  });
  return updated.brandId;
}
