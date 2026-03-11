import { prisma } from "./prisma";

export type OrderProfileSnapshot = {
  id: string;
  name?: string | null;
  jobTitle?: string | null;
  seniority?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  url?: string | null;
  linkedin?: string | null;
  addressId?: string | null;
  addressLabel?: string | null;
  companyName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  addressBlock?: string | null;
  updatedAt: string;
};

type OrderProfileInput = {
  name?: string | null;
  jobTitle?: string | null;
  seniority?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  url?: string | null;
  linkedin?: string | null;
  addressId?: string | null;
  addressLabel?: string | null;
  companyName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  addressBlock?: string | null;
};

function normalizeValue(value?: string | null) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function serializeProfile(profile: Awaited<ReturnType<typeof prisma.userOrderProfile.findUnique>>) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    jobTitle: profile.jobTitle,
    seniority: profile.seniority,
    email: profile.email,
    phone: profile.phone,
    mobile: profile.mobile,
    url: profile.url,
    linkedin: profile.linkedin,
    addressId: profile.addressId,
    addressLabel: profile.addressLabel,
    companyName: profile.companyName,
    street: profile.street,
    postalCode: profile.postalCode,
    city: profile.city,
    countryCode: profile.countryCode,
    addressBlock: profile.addressBlock,
    updatedAt: profile.updatedAt.toISOString(),
  } satisfies OrderProfileSnapshot;
}

export async function getUserOrderProfile(userId: string | null | undefined, brandId: string | null) {
  if (!userId || !brandId) {
    return null;
  }

  const profile = await prisma.userOrderProfile.findUnique({
    where: {
      userId_brandId: {
        userId,
        brandId,
      },
    },
  });

  return serializeProfile(profile);
}

export async function saveUserOrderProfile({
  userId,
  brandId,
  data,
}: {
  userId: string;
  brandId: string;
  data: OrderProfileInput;
}) {
  if (!userId || !brandId) return null;

  const payload = Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeValue(value as string | null)]),
  );

  const record = await prisma.userOrderProfile.upsert({
    where: {
      userId_brandId: {
        userId,
        brandId,
      },
    },
    update: payload,
    create: {
      ...payload,
      userId,
      brandId,
    },
  });

  return serializeProfile(record);
}
