import { prisma } from "@/lib/prisma";

export type AdminBrandAddress = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  addressExtra: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBrandSummary = {
  id: string;
  name: string;
  slug: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  templateCount: number;
  orderCount: number;
  addresses: AdminBrandAddress[];
  createdAt: string;
  updatedAt: string;
};

export async function getAdminBrands(): Promise<AdminBrandSummary[]> {
  const brands = await prisma.brand.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      templates: true,
      orders: { select: { id: true } },
      addresses: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    contactName: brand.contactName ?? null,
    contactEmail: brand.contactEmail ?? null,
    contactPhone: brand.contactPhone ?? null,
    templateCount: brand.templates.length,
    orderCount: brand.orders.length,
    addresses: brand.addresses.map((address) => ({
      id: address.id,
      label: address.label ?? null,
      company: address.company ?? null,
      street: address.street ?? null,
      addressExtra: address.addressExtra ?? null,
      postalCode: address.postalCode ?? null,
      city: address.city ?? null,
      countryCode: address.countryCode ?? null,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    })),
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  }));
}
