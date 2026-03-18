import { prisma } from "@/lib/prisma";
import { getTemplateForBrandOrGlobal, listTemplateSummariesForBrand } from "@/lib/templates";

type BrandAddressEntry = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  addressExtra?: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  cardAddressText?: string | null;
  url?: string | null;
};

type BrandPublicDomainEntry = {
  id: string;
  domain: string;
  isPrimary: boolean;
};

type BrandQrMode = "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "BOTH";
type BrandDefaultQrMode = "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | null;

type TemplateAddressMap = Record<string, string[]>;

type BrandResources = {
  brandId: string | null;
  templates: Awaited<ReturnType<typeof listTemplateSummariesForBrand>>;
  addresses: BrandAddressEntry[];
  publicDomains: BrandPublicDomainEntry[];
  templateAddressMap: TemplateAddressMap;
  qrMode: BrandQrMode;
  defaultQrMode: BrandDefaultQrMode;
  quantityMin: number | null;
  quantityMax: number | null;
  quantityStep: number | null;
  quantityOptions: number[] | null;
  initialTemplate: Awaited<ReturnType<typeof getTemplateForBrandOrGlobal>> | null;
  initialTemplateKey: string | null;
};

export async function getBrandResources(brandId: string | null): Promise<BrandResources> {
  if (!brandId) {
    return {
      templates: [],
      addresses: [],
      publicDomains: [],
      templateAddressMap: {},
      qrMode: "VCARD_ONLY",
      defaultQrMode: null,
      quantityMin: null,
      quantityMax: null,
      quantityStep: null,
      quantityOptions: null,
      initialTemplate: null,
      initialTemplateKey: null,
      brandId: null,
    };
  }

  const [templates, addressRecords, brand, publicDomains] = await Promise.all([
    listTemplateSummariesForBrand(brandId),
    prisma.brandAddress.findMany({
      where: { brandId },
      orderBy: [{ label: "asc" }, { company: "asc" }],
      select: {
        id: true,
        label: true,
        company: true,
        street: true,
        addressExtra: true,
        postalCode: true,
        city: true,
        countryCode: true,
        cardAddressText: true,
        url: true,
      },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        defaultTemplateId: true,
        qrMode: true,
        defaultQrMode: true,
        quantityMin: true,
        quantityMax: true,
        quantityStep: true,
        quantityOptions: true,
      },
    }),
    prisma.brandPublicDomain.findMany({
      where: { brandId },
      orderBy: [{ isPrimary: "desc" }, { domain: "asc" }],
      select: { id: true, domain: true, isPrimary: true },
    }),
  ]);

  const preferredSummary =
    (brand?.defaultTemplateId
      ? templates.find((tpl) => tpl.id === brand.defaultTemplateId)
      : undefined) ?? templates[0] ?? null;

  // Try preferred first, then fall through remaining templates until one resolves
  let initialTemplate = null;
  let initialSummary = null;
  const candidates = preferredSummary
    ? [preferredSummary, ...templates.filter((t) => t.id !== preferredSummary.id)]
    : templates;
  for (const candidate of candidates) {
    const resolved = brandId ? await getTemplateForBrandOrGlobal(candidate.key, brandId) : null;
    if (resolved) {
      initialTemplate = resolved;
      initialSummary = candidate;
      break;
    }
  }

  const addresses: BrandAddressEntry[] = addressRecords.map((address) => ({
    id: address.id,
    label: address.label,
    company: address.company,
    street: address.street,
    addressExtra: address.addressExtra,
    postalCode: address.postalCode,
    city: address.city,
    countryCode: address.countryCode,
    cardAddressText: address.cardAddressText,
    url: address.url,
  }));

  const templateIds = templates.map((template) => template.id);
  const templateAddressAssignments = templateIds.length
    ? await prisma.templateAddress.findMany({
        where: {
          templateId: { in: templateIds },
          brandAddress: { brandId },
        },
        select: {
          templateId: true,
          brandAddressId: true,
        },
      })
    : [];

  const templateAddressMap: TemplateAddressMap = {};
  for (const assignment of templateAddressAssignments) {
    if (!templateAddressMap[assignment.templateId]) {
      templateAddressMap[assignment.templateId] = [];
    }
    templateAddressMap[assignment.templateId]!.push(assignment.brandAddressId);
  }

  const normalizedDefaultQrMode: BrandDefaultQrMode =
    brand?.defaultQrMode === "VCARD_ONLY" || brand?.defaultQrMode === "PUBLIC_PROFILE_ONLY"
      ? brand.defaultQrMode
      : null;

  return {
    brandId,
    templates,
    addresses,
    publicDomains,
    templateAddressMap,
    qrMode: brand?.qrMode ?? "VCARD_ONLY",
    defaultQrMode: normalizedDefaultQrMode,
    quantityMin: brand?.quantityMin ?? null,
    quantityMax: brand?.quantityMax ?? null,
    quantityStep: brand?.quantityStep ?? null,
    quantityOptions: brand?.quantityOptions ?? null,
    initialTemplate,
    initialTemplateKey: initialSummary?.key ?? null,
  };
}
