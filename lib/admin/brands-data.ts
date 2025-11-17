import { prisma } from "@/lib/prisma";

export type AdminBrandTemplateLink = {
  assignmentId: string;
  templateId: string;
  templateKey: string;
  templateLabel: string;
  orderIndex: number;
};

export type AdminBrandAddress = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  addressExtra: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  cardAddressText: string | null;
  url: string | null;
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
  defaultTemplateId: string | null;
  templates: AdminBrandTemplateLink[];
  addresses: AdminBrandAddress[];
  domains: { id: string; domain: string }[];
  createdAt: string;
  updatedAt: string;
};

const brandInclude = {
  templates: {
    include: {
      template: {
        select: {
          id: true,
          key: true,
          label: true,
        },
      },
    },
    orderBy: [{ orderIndex: "asc" as const }, { assignedAt: "asc" as const }],
  },
  orders: { select: { id: true } },
  addresses: {
    orderBy: [{ createdAt: "asc" as const }],
  },
  domains: {
    orderBy: [{ domain: "asc" as const }],
  },
};

type RawBrand = Awaited<ReturnType<typeof prisma.brand.findMany>>[number] & {
  templates: {
    id: string;
    templateId: string;
    orderIndex: number;
    template: { id: string; key: string; label: string | null } | null;
  }[];
  orders: { id: string }[];
  addresses: {
    id: string;
    label: string | null;
    company: string | null;
    street: string | null;
    addressExtra: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string | null;
    cardAddressText: string | null;
    url: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  domains: {
    id: string;
    domain: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

function mapBrand(brand: RawBrand): AdminBrandSummary {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    contactName: brand.contactName ?? null,
    contactEmail: brand.contactEmail ?? null,
    contactPhone: brand.contactPhone ?? null,
    templateCount: brand.templates.length,
    orderCount: brand.orders.length,
    defaultTemplateId: brand.defaultTemplateId ?? null,
    templates: brand.templates
      .map((assignment) => ({
        assignmentId: assignment.id,
        templateId: assignment.templateId,
        templateKey: assignment.template?.key ?? "",
        templateLabel: assignment.template?.label ?? assignment.template?.key ?? assignment.templateId,
        orderIndex: assignment.orderIndex ?? 0,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex),
    addresses: brand.addresses.map((address) => ({
      id: address.id,
      label: address.label ?? null,
      company: address.company ?? null,
      street: address.street ?? null,
      addressExtra: address.addressExtra ?? null,
      postalCode: address.postalCode ?? null,
      city: address.city ?? null,
      countryCode: address.countryCode ?? null,
      cardAddressText: address.cardAddressText ?? null,
      url: address.url ?? null,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    })),
    domains: brand.domains
      .map((domain) => ({ id: domain.id, domain: domain.domain }))
      .sort((a, b) => a.domain.localeCompare(b.domain)),
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

export async function getAdminBrands(): Promise<AdminBrandSummary[]> {
  const brands = await prisma.brand.findMany({
    orderBy: [{ name: "asc" }],
    include: brandInclude,
  });

  return brands.map((brand) => mapBrand(brand as RawBrand));
}

export async function getAdminBrand(brandId: string): Promise<AdminBrandSummary | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: brandInclude,
  });

  if (!brand) {
    return null;
  }

  return mapBrand(brand as RawBrand);
}
