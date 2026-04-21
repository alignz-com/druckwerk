import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const addressSchema = z.object({
  id: z.string().cuid().optional(),
  label: z.string().trim().max(120).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  addressExtra: z.string().trim().max(200).optional().nullable(),
  postalCode: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  countryCode: z.string().trim().max(2).optional().nullable(),
  cardAddressText: z.string().trim().max(1000).optional().nullable(),
  url: z.string().trim().max(200).optional().nullable(),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  contactName: z.string().trim().max(200).optional().nullable(),
  contactEmail: z.string().trim().email().max(200).optional().nullable(),
  contactPhone: z.string().trim().max(100).optional().nullable(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
  qrMode: z.enum(["VCARD_ONLY", "PUBLIC_PROFILE_ONLY", "BOTH"]).optional(),
  defaultQrMode: z.enum(["VCARD_ONLY", "PUBLIC_PROFILE_ONLY"]).optional().nullable(),
  quantityMin: z.number().int().positive().optional().nullable(),
  quantityMax: z.number().int().positive().optional().nullable(),
  quantityStep: z.number().int().positive().optional().nullable(),
  quantityOptions: z.array(z.number().int().positive()).optional().nullable(),
  uploadQuantityMin: z.number().int().positive().optional().nullable(),
  uploadQuantityMax: z.number().int().positive().optional().nullable(),
  uploadQuantityStep: z.number().int().positive().optional().nullable(),
  uploadQuantityOptions: z.array(z.number().int().positive()).optional().nullable(),
  addresses: z.array(addressSchema).optional(),
  azureTenantId: z.string().trim().max(100).optional().nullable(),
});

export type BrandPayload = z.infer<typeof brandSchema>;
export type AddressPayload = z.infer<typeof addressSchema>;

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200) || "brand";
}

export async function ensureUniqueSlug(slug: string, excludeId?: string) {
  let candidate = slug;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.brand.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    counter += 1;
    candidate = `${slug}-${counter}`.slice(0, 200);
  }
}
