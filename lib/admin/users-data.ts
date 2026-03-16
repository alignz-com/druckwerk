import { prisma } from "@/lib/prisma";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  brandId: string | null;
  brandName: string | null;
  canOrderBusinessCards: boolean | null;
  canOrderPdfPrint: boolean | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

type RawUser = Awaited<ReturnType<typeof prisma.user.findMany>>[number] & {
  brand: { id: string; name: string } | null;
};

export function mapAdminUser(user: RawUser): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    brandId: user.brandId ?? null,
    brandName: user.brand?.name ?? null,
    canOrderBusinessCards: user.canOrderBusinessCards ?? null,
    canOrderPdfPrint: user.canOrderPdfPrint ?? null,
    isDemo: user.isDemo ?? false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      brand: { select: { id: true, name: true } },
    },
  });

  return users.map((user) => mapAdminUser(user as RawUser));
}
