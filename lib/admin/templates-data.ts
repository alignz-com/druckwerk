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

export type AdminPaperStockSummary = {
  id: string;
  name: string;
  description: string | null;
  finish: string | null;
  color: string | null;
  weightGsm: number | null;
};

export type AdminProductFormatSummary = {
  id: string;
  formatId: string;
  format: { id: string; name: string; trimWidthMm: number; trimHeightMm: number };
  canvasWidthMm: number | null;
  canvasHeightMm: number | null;
  printDpi: number | null;
  pcmCode: string | null;
};

export type AdminTemplateSummary = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  layoutVersion: number | null;
  printDpi: number | null;
  pageWidthMm: number | null;
  pageHeightMm: number | null;
  canvasWidthMm: number | null;
  canvasHeightMm: number | null;
  pcmCode: string | null;
  productId: string | null;
  product: { id: string; name: string; trimWidthMm: number | null; trimHeightMm: number | null; canvasWidthMm: number | null; canvasHeightMm: number | null; printDpi: number | null; pcmCode: string | null } | null;
  productFormatId: string | null;
  productFormat: AdminProductFormatSummary | null;
  paperStock: AdminPaperStockSummary | null;
  spotColors: Array<{ name: string; resourceName: string; page: number; alternateSpace: string; rgbFallback: string }> | null;
  hasQrCode: boolean;
  hasPhotoSlot: boolean;
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
  paperStock: true,
  product: {
    select: {
      id: true,
      name: true,
      trimWidthMm: true,
      trimHeightMm: true,
      canvasWidthMm: true,
      canvasHeightMm: true,
      printDpi: true,
      pcmCode: true,
    },
  },
  productFormat: {
    include: {
      format: {
        select: { id: true, name: true, trimWidthMm: true, trimHeightMm: true },
      },
    },
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
    pageWidthMm: template.pageWidthMm ?? null,
    pageHeightMm: template.pageHeightMm ?? null,
    canvasWidthMm: template.canvasWidthMm ?? null,
    canvasHeightMm: template.canvasHeightMm ?? null,
    pcmCode: template.pcmCode ?? null,
    productId: template.productId ?? null,
    product: template.product ?? null,
    productFormatId: template.productFormatId ?? null,
    productFormat: template.productFormat
      ? {
          id: template.productFormat.id,
          formatId: template.productFormat.formatId,
          format: template.productFormat.format,
          canvasWidthMm: template.productFormat.canvasWidthMm ?? null,
          canvasHeightMm: template.productFormat.canvasHeightMm ?? null,
          printDpi: template.productFormat.printDpi ?? null,
          pcmCode: template.productFormat.pcmCode ?? null,
        }
      : null,
    spotColors: (template.spotColors as AdminTemplateSummary["spotColors"]) ?? null,
    hasQrCode: template.hasQrCode,
    hasPhotoSlot: template.hasPhotoSlot,
    paperStock: template.paperStock
      ? {
          id: template.paperStock.id,
          name: template.paperStock.name,
          description: template.paperStock.description ?? null,
          finish: template.paperStock.finish ?? null,
          color: template.paperStock.color ?? null,
          weightGsm: template.paperStock.weightGsm ?? null,
        }
      : null,
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

type FontFamilyWithVariants = Prisma.FontFamilyGetPayload<{
  include: { variants: true };
}>;

function mapFontVariant(variant: FontFamilyWithVariants["variants"][number]): AdminFontVariant {
  return {
    id: variant.id,
    weight: variant.weight,
    style: variant.style,
    format: variant.format,
    fileName: variant.fileName ?? null,
    storageKey: variant.storageKey,
    sizeBytes: variant.sizeBytes ?? null,
    checksum: variant.checksum ?? null,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

export function mapFontFamily(family: FontFamilyWithVariants): AdminFontFamily {
  return {
    id: family.id,
    name: family.name,
    slug: family.slug,
    defaultWeight: family.defaultWeight ?? null,
    defaultStyle: family.defaultStyle ?? null,
    notes: family.notes ?? null,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
    variants: family.variants
      .map((variant) => mapFontVariant(variant))
      .sort((a, b) => {
        if (a.weight !== b.weight) {
          return a.weight - b.weight;
        }
        if (a.style !== b.style) {
          return a.style.localeCompare(b.style);
        }
        return a.format.localeCompare(b.format);
      }),
  };
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

  return families.map((family) => mapFontFamily(family as FontFamilyWithVariants));
}

export async function getAdminFontFamily(familyId: string): Promise<AdminFontFamily | null> {
  const family = await prisma.fontFamily.findUnique({
    where: { id: familyId },
    include: {
      variants: {
        orderBy: [{ weight: "asc" }, { style: "asc" }],
      },
    },
  });

  if (!family) {
    return null;
  }

  return mapFontFamily(family as FontFamilyWithVariants);
}
