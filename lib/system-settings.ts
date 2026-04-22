import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

export async function updateSystemSettings(
  data: Partial<{
    companyName: string;
    logoUrl: string | null;
    logoDarkUrl: string | null;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string | null;
    confirmationFontFamily: string | null;
    emailBcc: string | null;
    letterheadUrl: string | null;
    letterheadStoragePath: string | null;
    safeTopMm: number | null;
    safeBottomMm: number | null;
    safeLeftMm: number | null;
    safeRightMm: number | null;
    addressWindowXMm: number | null;
    addressWindowYMm: number | null;
    addressWindowWidthMm: number | null;
    addressWindowHeightMm: number | null;
  }>,
) {
  return prisma.systemSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });
}
