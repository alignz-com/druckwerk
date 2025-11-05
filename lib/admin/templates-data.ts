import { prisma } from "@/lib/prisma";
import type { FontFormat, FontStyle, TemplateAssetType, Prisma } from "@prisma/client";

export type AdminTemplateAsset = {
  id: string;
  type: TemplateAssetType;
  fileName: string | null;
  storageKey: string;
  mimeType: string;
  version: number;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTemplateFontLink = {
  id: string;
  usage: string | null;
  fontVariantId: string;
  fontFamilyId: string;
  fontFamilyName: string;
  fontFamilySlug: string;
  weight: number;
  style: FontStyle;
  format: FontFormat;
  fileName: string | null;
};

export type AdminTemplateSummary = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  layoutVersion: number | null;
  printDpi: number | null;
  createdAt: string;
  updatedAt: string;
  config: Prisma.JsonValue | null;
  assets: AdminTemplateAsset[];
  fonts: AdminTemplateFontLink[];
  brandAssignments: AdminTemplateBrandAssignment[];
};

export type AdminFontVariant = {
  id: string;
  weight: number;
  style: FontStyle;
  format: FontFormat;
  fileName: string | null;
  storageKey: string;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTemplateBrandAssignment = {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  assignedAt: string;
};

export type AdminFontFamily = {
  id: string;
  name: string;
  slug: string;
  defaultWeight: number | null;
  defaultStyle: FontStyle | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  variants: AdminFontVariant[];
};

export const adminTemplateSummaryInclude = {
  assets: {
    orderBy: [
      { version: "desc" as const },
      { updatedAt: "desc" as const },
    ],
  },
  fonts: {
    include: {
      fontVariant: {
        include: {
          fontFamily: true,
        },
      },
    },
  },
  assignments: {
    include: {
      brand: true,
    },
    orderBy: [{ assignedAt: "desc" as const }],
  },
} satisfies Prisma.TemplateInclude;

type TemplateWithRelations = Prisma.TemplateGetPayload<{
  include: typeof adminTemplateSummaryInclude;
}>;

export function mapTemplateToAdminSummary(template: TemplateWithRelations): AdminTemplateSummary {
  return {
    id: template.id,
    key: template.key,
    label: template.label,
    description: template.description,
    layoutVersion: template.layoutVersion,
    printDpi: template.printDpi,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    config: template.config,
    assets: template.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      fileName: asset.fileName,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      version: asset.version,
      sizeBytes: asset.sizeBytes,
      checksum: asset.checksum,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    })),
    fonts: template.fonts
      .filter((link) => Boolean(link.fontVariant))
      .map((link) => {
        const variant = link.fontVariant!;
        const family = variant.fontFamily!;
        return {
          id: link.id,
          usage: link.usage,
          fontVariantId: variant.id,
          fontFamilyId: family.id,
          fontFamilyName: family.name,
          fontFamilySlug: family.slug,
          weight: variant.weight,
          style: variant.style,
          format: variant.format,
          fileName: variant.fileName,
        };
      }),
    brandAssignments: template.assignments
      .filter((assignment) => Boolean(assignment.brand))
      .map((assignment) => ({
        id: assignment.id,
        brandId: assignment.brandId,
        brandName: assignment.brand!.name,
        brandSlug: assignment.brand!.slug,
        assignedAt: assignment.assignedAt.toISOString(),
      })),
  };
}

export async function getAdminTemplateSummaries(): Promise<AdminTemplateSummary[]> {
  const templates = await prisma.template.findMany({
    orderBy: [{ label: "asc" }, { createdAt: "asc" }],
    include: adminTemplateSummaryInclude,
  });

  return templates.map((template) => mapTemplateToAdminSummary(template));
}

export async function getAdminFontFamilies(): Promise<AdminFontFamily[]> {
  const families = await prisma.fontFamily.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      variants: {
        orderBy: [{ weight: "asc" }, { style: "asc" }],
      },
    },
  });

  return families.map((family) => ({
    id: family.id,
    name: family.name,
    slug: family.slug,
    defaultWeight: family.defaultWeight,
    defaultStyle: family.defaultStyle,
    notes: family.notes,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
    variants: family.variants.map((variant) => ({
      id: variant.id,
      weight: variant.weight,
      style: variant.style,
      format: variant.format,
      fileName: variant.fileName,
      storageKey: variant.storageKey,
      sizeBytes: variant.sizeBytes,
      checksum: variant.checksum,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    })),
  }));
}
