import { TemplateAssetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { DEFAULT_TEMPLATES, TemplateConfig, TemplateDefinition, TemplateAssetSummary } from "./templates-defaults";
import {
  DEFAULT_TEMPLATE_DESIGN,
  extractDesignFromConfigSource,
  parseTemplateDesign,
  type TemplateDesign,
} from "./template-design";
import { getSignedUrl } from "./storage";

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

export type ResolvedTemplate = Omit<TemplateDefinition, "paperStock"> & {
  fonts: ResolvedTemplateFont[];
  paperStock: TemplatePaperStock | null;
};

function resolvedFromDefinition(def: TemplateDefinition): ResolvedTemplate {
  const cloned = clone(def) as TemplateDefinition;
  const { paperStock, ...rest } = cloned;
  return {
    ...rest,
    assets: rest.assets ? clone(rest.assets) : [],
    design: rest.design ? clone(rest.design) : DEFAULT_TEMPLATE_DESIGN,
    fonts: [],
    paperStock: paperStock ? { ...paperStock } : null,
  };
}

function sortTemplates(templates: Iterable<ResolvedTemplate>) {
  return Array.from(templates).sort((a, b) => a.label.localeCompare(b.label));
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
};

type TemplateWithAssets = Prisma.TemplateGetPayload<{ include: typeof templateInclude }>;
function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_TTL_MS = SIGNED_URL_TTL_SECONDS * 1000;

function buildTemplateAssetPublicUrl(storageKey: string | null | undefined) {
  if (!storageKey) return null;
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(TEMPLATE_BUCKET)}/${encodeStoragePath(storageKey)}`;
}

async function resolveTemplateFromDb(tpl: TemplateWithAssets, fallback?: TemplateDefinition): Promise<ResolvedTemplate> {
  const baseConfig = fallback?.config ?? ((tpl.config ?? {}) as TemplateConfig);
  const assets: TemplateAssetSummary[] = await Promise.all(
    tpl.assets.map(async (asset) => {
      const directUrl = buildTemplateAssetPublicUrl(asset.storageKey);
      let signedUrl: string | null = null;
      let expiresAt: string | undefined;
      try {
        signedUrl = await getSignedUrl(TEMPLATE_BUCKET, asset.storageKey, SIGNED_URL_TTL_SECONDS);
        expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();
      } catch (error) {
        console.warn(`[templates] Failed to sign asset ${asset.storageKey}`, error);
      }
      return {
        type: asset.type,
        storageKey: asset.storageKey,
        publicUrl: signedUrl ?? directUrl ?? null,
        version: asset.version,
        updatedAt: asset.updatedAt.toISOString(),
        expiresAt,
      };
    }),
  );

  const pdfAsset = assets.find((asset) => asset.type === TemplateAssetType.PDF);
  const previewFrontAsset = assets.find((asset) => asset.type === TemplateAssetType.PREVIEW_FRONT);
  const previewBackAsset = assets.find((asset) => asset.type === TemplateAssetType.PREVIEW_BACK);
  const designFromConfig = extractDesignFromConfigSource(tpl.config);
  const design = designFromConfig ?? (await loadTemplateDesign(tpl.assets, fallback?.design));
  const fonts: ResolvedTemplateFont[] = await Promise.all(
    tpl.fonts
      .filter((link) => link.fontVariant && link.fontVariant.fontFamily)
      .map(async (link) => {
        const variant = link.fontVariant!;
        const family = variant.fontFamily!;
        let publicUrl: string | null = null;
        let expiresAt: string | undefined;
        try {
        publicUrl = await getSignedUrl(
          process.env.SUPABASE_FONT_BUCKET ?? "fonts",
          variant.storageKey,
          SIGNED_URL_TTL_SECONDS,
        );
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

  const resolved: ResolvedTemplate = {
    id: tpl.id,
    key: tpl.key,
    label: tpl.label ?? fallback?.label ?? tpl.key,
    description: tpl.description ?? fallback?.description,
    pdfPath: pdfAsset?.publicUrl ?? tpl.pdfPath ?? fallback?.pdfPath ?? "",
    previewFrontPath: previewFrontAsset?.publicUrl ?? tpl.previewFrontPath ?? fallback?.previewFrontPath ?? "",
    previewBackPath: previewBackAsset?.publicUrl ?? tpl.previewBackPath ?? fallback?.previewBackPath ?? "",
    config: mergeConfigs(baseConfig, tpl.config ?? undefined),
    assets,
    design,
    fonts,
    paperStock: paperStockFromDb ?? (fallback?.paperStock ? { ...fallback.paperStock } : null),
  };

  if (!resolved.pdfPath) {
    throw new Error(`Template ${tpl.key} is missing pdfPath`);
  }

  return resolved;
}

async function loadTemplateDesign(assets: TemplateWithAssets["assets"], fallback?: TemplateDesign): Promise<TemplateDesign> {
  const configAsset = assets.find((asset) => asset.type === TemplateAssetType.CONFIG);
  if (!configAsset) {
    return fallback ?? DEFAULT_TEMPLATE_DESIGN;
  }
  try {
    const url = await getSignedUrl(TEMPLATE_BUCKET, configAsset.storageKey, SIGNED_URL_TTL_SECONDS);
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

type ListTemplatesOptions = {
  fallbackToDefaults?: boolean;
};

export async function listTemplatesForBrand(
  brandId?: string | null,
  options?: ListTemplatesOptions,
): Promise<ResolvedTemplate[]> {
  const fallbackToDefaults = options?.fallbackToDefaults !== false;
  try {
    if (brandId) {
      const assignments = await prisma.brandTemplate.findMany({
        where: { brandId },
        include: { template: { include: templateInclude } },
      });

      const resolvedAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          const tpl = assignment.template;
          if (!tpl) return null;
          const resolved = await resolveTemplateFromDb(tpl, fallbackToDefaults ? DEFAULT_TEMPLATES[tpl.key] : undefined);
          return {
            key: resolved.key,
            template: {
              ...resolved,
              config: mergeConfigs(resolved.config, assignment.configOverride ?? undefined),
            },
          };
        }),
      );

      const filtered = resolvedAssignments.filter((item): item is { key: string; template: ResolvedTemplate } => Boolean(item));
      const map = new Map<string, ResolvedTemplate>();
      for (const entry of filtered) {
        map.set(entry.key, entry.template);
      }

      return sortTemplates(map.values());
    }

    const dbTemplates = await prisma.template.findMany({ include: templateInclude });
    const resolvedTemplates = await Promise.all(
      dbTemplates.map((tpl) => resolveTemplateFromDb(tpl, fallbackToDefaults ? DEFAULT_TEMPLATES[tpl.key] : undefined)),
    );
    return sortTemplates(resolvedTemplates);
  } catch (error) {
    console.warn("[templates] Failed to load templates", error);
    return [];
  }
}

export async function getTemplateByKey(key: string, brandId?: string | null): Promise<ResolvedTemplate> {
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
      return {
        ...resolved,
        config: mergeConfigs(resolved.config, assignment.configOverride ?? undefined),
      };
    }

    throw new Error(`Template ${key} is not assigned to brand ${brandId}`);
  }

  const tpl = await prisma.template.findUnique({
    where: { key },
    include: templateInclude,
  });

  if (tpl) {
    return resolveTemplateFromDb(tpl, DEFAULT_TEMPLATES[key]);
  }

  const fallback = DEFAULT_TEMPLATES[key];
  if (fallback) return resolvedFromDefinition(fallback);

  throw new Error(`Unknown template key: ${key}`);
}
