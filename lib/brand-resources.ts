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

export async function getBrandResources(brandId: string | null) {
  if (!brandId) {
    return {
      templates: [],
      addresses: [] as BrandAddressEntry[],
      initialTemplate: null,
      initialTemplateKey: null,
      brandId: null as string | null,
    };
  }

  const [templates, addressRecords, brand] = await Promise.all([
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
      select: { defaultTemplateId: true },
    }),
  ]);

  const initialSummary =
    (brand?.defaultTemplateId
      ? templates.find((tpl) => tpl.id === brand.defaultTemplateId)
      : undefined) ?? templates[0] ?? null;

  const initialTemplate =
    initialSummary && brandId ? await getTemplateForBrandOrGlobal(initialSummary.key, brandId) : null;

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

  return {
    brandId,
    templates,
    addresses,
    initialTemplate,
    initialTemplateKey: initialSummary?.key ?? null,
  };
}
