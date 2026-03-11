import { prisma } from "@/lib/prisma";

const fallbackDomain = (process.env.VCARD_FALLBACK_DOMAIN || "vcard.alignz.io").toLowerCase();
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const vercelUrl = process.env.VERCEL_URL || "";

const allowedHosts = new Set<string>(
  [fallbackDomain]
    .concat([appUrl, vercelUrl].filter(Boolean))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).host.toLowerCase();
      } catch {
        return value.toLowerCase().replace(/^https?:\/\//, "");
      }
    }),
);

export type PublicContact = {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  linkedin: string | null;
  photoUrl: string | null;
  address?: {
    company?: string | null;
    street?: string | null;
    addressExtra?: string | null;
    postalCode?: string | null;
    city?: string | null;
    countryCode?: string | null;
  } | null;
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

export async function getPublicContact(publicId: string, host?: string | null): Promise<PublicContact | null> {
  const normalizedHost = (host || "").split(":")[0]?.toLowerCase();
  let brandId: string | null = null;

  if (normalizedHost && !allowedHosts.has(normalizedHost)) {
    const domain = await prisma.brandPublicDomain.findFirst({
      where: { domain: normalizedHost },
      select: { brandId: true },
    });
    brandId = domain?.brandId ?? null;
    if (!brandId) {
      return null;
    }
  }

  const contact = await prisma.contact.findFirst({
    where: brandId ? { publicId, brandId } : { publicId },
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      title: true,
      department: true,
      email: true,
      phone: true,
      mobile: true,
      website: true,
      linkedin: true,
      photoUrl: true,
      addressId: true,
      brand: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!contact) return null;

  let address: PublicContact["address"] = null;
  if (contact.addressId) {
    address = await prisma.brandAddress.findFirst({
      where: { id: contact.addressId, brandId: contact.brand.id },
      select: {
        company: true,
        street: true,
        addressExtra: true,
        postalCode: true,
        city: true,
        countryCode: true,
      },
    });
  }

  return { ...contact, address } as PublicContact;
}
