import { TemplateAssetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { DEFAULT_TEMPLATES, TemplateConfig, TemplateDefinition, TemplateAssetSummary } from "./templates-defaults";

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

export type ResolvedTemplate = TemplateDefinition;

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
};

type TemplateWithAssets = Prisma.TemplateGetPayload<{ include: typeof templateInclude }>;
function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildTemplateAssetPublicUrl(storageKey: string | null | undefined) {
  if (!storageKey) return null;
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl) return null;
  const bucket = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(storageKey)}`;
}

function findAssetUrl(assets: TemplateWithAssets["assets"], type: TemplateAssetType) {
  const asset = assets.find((item) => item.type === type);
  if (!asset) return null;
  return buildTemplateAssetPublicUrl(asset.storageKey);
}

function resolveTemplateFromDb(tpl: TemplateWithAssets, fallback?: TemplateDefinition): ResolvedTemplate {
  const baseConfig = fallback?.config ?? ((tpl.config ?? {}) as TemplateConfig);
  const pdfUrl = findAssetUrl(tpl.assets, TemplateAssetType.PDF);
  const previewFrontUrl = findAssetUrl(tpl.assets, TemplateAssetType.PREVIEW_FRONT);
  const previewBackUrl = findAssetUrl(tpl.assets, TemplateAssetType.PREVIEW_BACK);
  const assets: TemplateAssetSummary[] = tpl.assets.map((asset) => ({
    type: asset.type,
    storageKey: asset.storageKey,
    publicUrl: buildTemplateAssetPublicUrl(asset.storageKey),
    version: asset.version,
    updatedAt: asset.updatedAt.toISOString(),
  }));

  const resolved: ResolvedTemplate = {
    id: tpl.id,
    key: tpl.key,
    label: tpl.label ?? fallback?.label ?? tpl.key,
    description: tpl.description ?? fallback?.description,
    pdfPath: pdfUrl ?? tpl.pdfPath ?? fallback?.pdfPath ?? "",
    previewFrontPath: previewFrontUrl ?? tpl.previewFrontPath ?? fallback?.previewFrontPath ?? "",
    previewBackPath: previewBackUrl ?? tpl.previewBackPath ?? fallback?.previewBackPath ?? "",
    config: mergeConfigs(baseConfig, tpl.config ?? undefined),
    assets,
  };

  if (!resolved.pdfPath) {
    throw new Error(`Template ${tpl.key} is missing pdfPath`);
  }

  return resolved;
}

export async function listTemplatesForBrand(brandId?: string | null): Promise<ResolvedTemplate[]> {
  try {
    if (brandId) {
      const assignments = await prisma.brandTemplate.findMany({
        where: { brandId },
        include: { template: { include: templateInclude } },
      });

      const resolvedAssignments = new Map<string, ResolvedTemplate>();
      for (const assignment of assignments) {
        const tpl = assignment.template;
        if (!tpl) continue;
        const resolved = resolveTemplateFromDb(tpl, DEFAULT_TEMPLATES[tpl.key]);
        const merged: ResolvedTemplate = {
          ...resolved,
          config: mergeConfigs(resolved.config, assignment.configOverride ?? undefined),
        };
        resolvedAssignments.set(merged.key, merged);
      }

      return sortTemplates(resolvedAssignments.values());
    }

    const dbTemplates = await prisma.template.findMany({ include: templateInclude });
    const resolvedTemplates = dbTemplates.map((tpl) => resolveTemplateFromDb(tpl, DEFAULT_TEMPLATES[tpl.key]));
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
      const resolved = resolveTemplateFromDb(assignment.template, DEFAULT_TEMPLATES[key]);
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
  if (fallback) return clone(fallback);

  throw new Error(`Unknown template key: ${key}`);
}
