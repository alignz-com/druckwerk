import { TemplateAssetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  DEFAULT_TEMPLATE_LIST,
  DEFAULT_TEMPLATES,
  TemplateConfig,
  TemplateDefinition,
  TemplateAssetSummary,
  TemplatePhotoSlotConfig,
} from "./templates-defaults";
import {
  DEFAULT_TEMPLATE_DESIGN,
  extractDesignFromConfigSource,
  parseTemplateDesign,
  type TemplateDesign,
} from "./template-design";
import { getSignedUrl, getTemplateAssetPublicUrl } from "./storage";
import { FONT_BUCKET } from "./s3";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeConfigs(base: TemplateConfig, override?: unknown): TemplateConfig {
  if (!override) return clone(base);
  const target = clone(base);

  const apply = (dst: any, src: any) => {
    if (typeof src !== "object" || src === null) return;
    for (const [key, value] of Object.entries(src)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "object" && !Array.isArray(value)) {
        if (!dst[key]) dst[key] = {};
        apply(dst[key], value);
      } else {
        dst[key] = value;
      }
    }
  };

  apply(target, override);
  return target;
}

export type ResolvedTemplateFont = {
  id: string;
  fontFamilyName: string;
  fontFamilySlug: string;
  fontVariantId: string;
  storageKey: string;
  fileName: string | null;
  weight: number;
  style: string;
  format: string;
  publicUrl: string | null;
  expiresAt?: string;
};

export type TemplatePaperStock = {
  id?: string;
  name: string;
  description?: string | null;
  finish?: string | null;
  color?: string | null;
  weightGsm?: number | null;
};

export type TemplatePhotoSlot = TemplatePhotoSlotConfig & {
  side: "front" | "back";
  shape: "circle" | "square" | "rounded";
};

export type ResolvedTemplateProduct = {
  id: string;
  name: string;
  trimWidthMm: number | null;
  trimHeightMm: number | null;
  canvasWidthMm: number | null;
  canvasHeightMm: number | null;
  printDpi: number | null;
  pcmCode: string | null;
};

export type ResolvedTemplate = Omit<TemplateDefinition, "paperStock" | "hasQrCode" | "hasPhotoSlot"> & {
  fonts: ResolvedTemplateFont[];
  paperStock: TemplatePaperStock | null;
  hasQrCode: boolean;
  hasPhotoSlot: boolean;
  photoSlot: TemplatePhotoSlot | null;
  product: ResolvedTemplateProduct | null;
};

export type TemplateSummary = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  orderIndex: number;
  hasQrCode: boolean;
  hasPhotoSlot: boolean;
};

function resolvedFromDefinition(def: TemplateDefinition): ResolvedTemplate {
  const cloned = clone(def) as TemplateDefinition;
  const { paperStock, ...rest } = cloned;
  const normalizedPhoto = normalizePhotoSlot(def.config?.photo ?? null);
  return {
    ...rest,
    assets: rest.assets ? clone(rest.assets) : [],
    design: rest.design ? clone(rest.design) : DEFAULT_TEMPLATE_DESIGN,
    fonts: [],
    paperStock: paperStock ? { ...paperStock } : null,
    hasQrCode: detectHasQrCode(def.hasQrCode ?? null, def.config),
    hasPhotoSlot: detectHasPhotoSlot(def.hasPhotoSlot ?? null, def.config),
    photoSlot: normalizedPhoto,
    product: null,
  };
}

function sortTemplates(templates: Iterable<ResolvedTemplate>) {
  return Array.from(templates).sort((a, b) => a.label.localeCompare(b.label));
}

function detectHasQrCode(explicit?: boolean | null, config?: TemplateConfig | null): boolean {
  if (typeof explicit === "boolean") return explicit;
  return (config?.back?.mode ?? null) === "qr";
}

function detectHasPhotoSlot(explicit?: boolean | null, config?: TemplateConfig | null): boolean {
  if (typeof explicit === "boolean") return explicit;
  return Boolean(normalizePhotoSlot(config?.photo ?? null));
}

function sortSummaries(summaries: Iterable<TemplateSummary>) {
  return Array.from(summaries).sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex - b.orderIndex;
    }
    return a.label.localeCompare(b.label);
  });
}

export async function listTemplateSummariesForBrand(brandId?: string | null): Promise<TemplateSummary[]> {
  if (brandId) {
    const assignments = await prisma.brandTemplate.findMany({
      where: {
        brandId,
        template: { assets: { some: { type: TemplateAssetType.PDF } } },
      },
      include: {
        template: {
          select: {
            id: true,
            key: true,
            label: true,
            description: true,
            hasQrCode: true,
            hasPhotoSlot: true,
          },
        },
      },
      orderBy: [{ orderIndex: "asc" }, { assignedAt: "asc" }],
    });

    return assignments
      .filter((assignment) => assignment.template)
      .map((assignment) => ({
        id: assignment.template!.id,
        key: assignment.template!.key,
        label: assignment.template!.label,
        description: assignment.template!.description ?? null,
        orderIndex: assignment.orderIndex ?? 0,
        hasQrCode: assignment.template!.hasQrCode,
        hasPhotoSlot: assignment.template!.hasPhotoSlot ?? false,
      }));
  }

  const dbTemplates = await prisma.template.findMany({
    where: { assets: { some: { type: TemplateAssetType.PDF } } },
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      hasQrCode: true,
      hasPhotoSlot: true,
    },
    orderBy: [{ label: "asc" }],
  });

  return dbTemplates.map((tpl, index) => ({
    id: tpl.id,
    key: tpl.key,
    label: tpl.label,
    description: tpl.description ?? null,
    orderIndex: index,
    hasQrCode: tpl.hasQrCode,
    hasPhotoSlot: tpl.hasPhotoSlot ?? false,
  }));
}

const templateInclude = {
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
};

type TemplateWithAssets = Prisma.TemplateGetPayload<{ include: typeof templateInclude }>;

const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_TTL_MS = SIGNED_URL_TTL_SECONDS * 1000;

async function resolveTemplateFromDb(tpl: TemplateWithAssets, fallback?: TemplateDefinition): Promise<ResolvedTemplate | null> {
  const baseConfig = fallback?.config ?? ((tpl.config ?? {}) as TemplateConfig);
  const mergedConfig = mergeConfigs(baseConfig, tpl.config ?? undefined);
  const assets: TemplateAssetSummary[] = tpl.assets.map((asset) => ({
    type: asset.type,
    storageKey: asset.storageKey,
    publicUrl: getTemplateAssetPublicUrl(asset.storageKey),
    version: asset.version,
    updatedAt: asset.updatedAt.toISOString(),
  }));

  const pdfAsset = assets.find((asset) => asset.type === TemplateAssetType.PDF);
  const previewFrontAsset = assets.find((asset) => asset.type === TemplateAssetType.PREVIEW_FRONT);
  const previewBackAsset = assets.find((asset) => asset.type === TemplateAssetType.PREVIEW_BACK);
  const designFromConfig = extractDesignFromConfigSource(tpl.config);
  const design = designFromConfig ?? (await loadTemplateDesign(tpl.assets, fallback?.design));
  const photoSlot = normalizePhotoSlot(mergedConfig.photo ?? null);
  const hasPhotoSlot = detectHasPhotoSlot(tpl.hasPhotoSlot ?? null, mergedConfig);
  const fonts: ResolvedTemplateFont[] = await Promise.all(
    tpl.fonts
      .filter((link) => link.fontVariant && link.fontVariant.fontFamily)
      .map(async (link) => {
        const variant = link.fontVariant!;
        const family = variant.fontFamily!;
        let publicUrl: string | null = null;
        let expiresAt: string | undefined;
        try {
        publicUrl = await getSignedUrl(FONT_BUCKET, variant.storageKey, SIGNED_URL_TTL_SECONDS);
        expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();
      } catch (error) {
        console.warn(`[templates] Failed to sign font ${variant.storageKey}`, error);
      }
      return {
        id: link.id,
        fontFamilyName: family.name,
        fontFamilySlug: family.slug,
        fontVariantId: variant.id,
        storageKey: variant.storageKey,
        fileName: variant.fileName ?? null,
        weight: variant.weight,
        style: variant.style,
          format: variant.format,
          publicUrl,
          expiresAt,
        };
      }),
  );

  const paperStockFromDb: TemplatePaperStock | null = tpl.paperStock
    ? {
        id: tpl.paperStock.id,
        name: tpl.paperStock.name,
        description: tpl.paperStock.description ?? null,
        finish: tpl.paperStock.finish ?? null,
        color: tpl.paperStock.color ?? null,
        weightGsm: tpl.paperStock.weightGsm ?? null,
      }
    : null;

  // Dimension fallback chain: template → productFormat → product → fallback default
  const product = tpl.product ?? null;
  const productFormat = tpl.productFormat ?? null;
  const resolvedPageWidthMm = tpl.pageWidthMm ?? productFormat?.format?.trimWidthMm ?? product?.trimWidthMm ?? fallback?.pageWidthMm ?? null;
  const resolvedPageHeightMm = tpl.pageHeightMm ?? productFormat?.format?.trimHeightMm ?? product?.trimHeightMm ?? fallback?.pageHeightMm ?? null;
  const resolvedCanvasWidthMm = tpl.canvasWidthMm ?? productFormat?.canvasWidthMm ?? product?.canvasWidthMm ?? fallback?.canvasWidthMm ?? null;
  const resolvedCanvasHeightMm = tpl.canvasHeightMm ?? productFormat?.canvasHeightMm ?? product?.canvasHeightMm ?? fallback?.canvasHeightMm ?? null;

  const resolved: ResolvedTemplate = {
    id: tpl.id,
    key: tpl.key,
    label: tpl.label ?? fallback?.label ?? tpl.key,
    description: tpl.description ?? fallback?.description,
    pcmCode: tpl.pcmCode ?? productFormat?.pcmCode ?? product?.pcmCode ?? fallback?.pcmCode ?? null,
    pageWidthMm: resolvedPageWidthMm,
    pageHeightMm: resolvedPageHeightMm,
    canvasWidthMm: resolvedCanvasWidthMm,
    canvasHeightMm: resolvedCanvasHeightMm,
    product: product
      ? {
          id: product.id,
          name: product.name,
          trimWidthMm: resolvedPageWidthMm,
          trimHeightMm: resolvedPageHeightMm,
          canvasWidthMm: resolvedCanvasWidthMm,
          canvasHeightMm: resolvedCanvasHeightMm,
          printDpi: productFormat?.printDpi ?? product.printDpi ?? null,
          pcmCode: productFormat?.pcmCode ?? product.pcmCode ?? null,
        }
      : null,
    pdfPath: pdfAsset?.publicUrl ?? tpl.pdfPath ?? fallback?.pdfPath ?? "",
    previewFrontPath: previewFrontAsset?.publicUrl ?? tpl.previewFrontPath ?? fallback?.previewFrontPath ?? "",
    previewBackPath: previewBackAsset?.publicUrl ?? tpl.previewBackPath ?? fallback?.previewBackPath ?? "",
    config: mergedConfig,
    assets,
    design,
    fonts,
    paperStock: paperStockFromDb ?? (fallback?.paperStock ? { ...fallback.paperStock } : null),
    hasQrCode: detectHasQrCode(tpl.hasQrCode, mergedConfig),
    hasPhotoSlot,
    photoSlot,
  };

  if (!resolved.pdfPath) {
    console.warn(`[templates] Template ${tpl.key} is missing pdfPath — skipping`);
    return null;
  }

  return resolved;
}

async function loadTemplateDesign(assets: TemplateWithAssets["assets"], fallback?: TemplateDesign): Promise<TemplateDesign> {
  const configAsset = assets.find((asset) => asset.type === TemplateAssetType.CONFIG);
  if (!configAsset) {
    return fallback ?? DEFAULT_TEMPLATE_DESIGN;
  }
  try {
    const url = getTemplateAssetPublicUrl(configAsset.storageKey);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch template design (${res.status})`);
    }
    const json = await res.json();
    return parseTemplateDesign(json);
  } catch (error) {
    console.warn(`[templates] Failed to load design for ${configAsset.storageKey}`, error);
    return fallback ?? DEFAULT_TEMPLATE_DESIGN;
  }
}


export async function getTemplateByKey(key: string, brandId?: string | null): Promise<ResolvedTemplate | null> {
  if (brandId) {
    const assignment = await prisma.brandTemplate.findFirst({
      where: {
        brandId,
        template: { key },
      },
      include: { template: { include: templateInclude } },
    });

    if (assignment?.template) {
      const resolved = await resolveTemplateFromDb(assignment.template, DEFAULT_TEMPLATES[key]);
      if (!resolved) return null;
      const config = mergeConfigs(resolved.config, assignment.configOverride ?? undefined);
      return {
        ...resolved,
        config,
        hasPhotoSlot: detectHasPhotoSlot(assignment.template.hasPhotoSlot ?? resolved.hasPhotoSlot, config),
        photoSlot: normalizePhotoSlot(config.photo ?? null),
      };
    }

    throw new Error(`Template ${key} is not assigned to brand ${brandId}`);
  }

  const tpl = await prisma.template.findUnique({
    where: { key },
    include: templateInclude,
  });

  if (tpl) {
    return resolveTemplateFromDb(tpl, DEFAULT_TEMPLATES[key]) ?? null;
  }

  const fallback = DEFAULT_TEMPLATES[key];
  if (fallback) {
    throw new Error(`Template ${key} not found in database`);
  }

  throw new Error(`Unknown template key: ${key}`);
}

export async function getTemplateForBrandOrGlobal(key: string, brandId?: string | null): Promise<ResolvedTemplate | null> {
  if (!brandId) {
    return getTemplateByKey(key, null);
  }

  try {
    return await getTemplateByKey(key, brandId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not assigned to brand")) {
      return getTemplateByKey(key, null);
    }
    throw error;
  }
}
function normalizePhotoSlot(config?: TemplatePhotoSlotConfig | null): TemplatePhotoSlot | null {
  if (!config) return null;
  const { xMm, yMm, widthMm, heightMm } = config;
  if (
    typeof xMm !== "number" ||
    typeof yMm !== "number" ||
    typeof widthMm !== "number" ||
    typeof heightMm !== "number"
  ) {
    return null;
  }
  const side = config.side === "back" ? "back" : "front";
  const shape = config.shape === "square" ? "square" : config.shape === "rounded" ? "rounded" : "circle";
  return {
    side,
    shape,
    xMm,
    yMm,
    widthMm,
    heightMm,
    borderColor: config.borderColor,
    borderWidthMm: config.borderWidthMm,
  };
}
