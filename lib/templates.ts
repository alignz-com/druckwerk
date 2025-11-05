import { TemplateAssetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { DEFAULT_TEMPLATES, TemplateConfig, TemplateDefinition } from "./templates-defaults";

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
type BrandTemplateWithTemplateKey = Prisma.BrandTemplateGetPayload<{
  include: { template: { select: { key: true } } };
}>;

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

  const resolved: ResolvedTemplate = {
    id: tpl.id,
    key: tpl.key,
    label: tpl.label ?? fallback?.label ?? tpl.key,
    description: tpl.description ?? fallback?.description,
    pdfPath: pdfUrl ?? tpl.pdfPath ?? fallback?.pdfPath ?? "",
    previewFrontPath: previewFrontUrl ?? tpl.previewFrontPath ?? fallback?.previewFrontPath ?? "",
    previewBackPath: previewBackUrl ?? tpl.previewBackPath ?? fallback?.previewBackPath ?? "",
    config: mergeConfigs(baseConfig, tpl.config ?? undefined),
  };

  if (!resolved.pdfPath) {
    throw new Error(`Template ${tpl.key} is missing pdfPath`);
  }

  return resolved;
}

export async function listTemplatesForBrand(brandId?: string | null): Promise<ResolvedTemplate[]> {
  try {
    const templateById = new Map<string, ResolvedTemplate>();
    const templateByKey = new Map<string, ResolvedTemplate>();

    const [dbTemplates, brandAssignments] = await Promise.all([
      prisma.template.findMany({ include: templateInclude }),
      brandId
        ? prisma.brandTemplate.findMany({
            where: { brandId },
            include: { template: { select: { key: true } } },
          })
        : Promise.resolve([] as BrandTemplateWithTemplateKey[]),
    ]);

    for (const tpl of dbTemplates) {
      const fallback = DEFAULT_TEMPLATES[tpl.key];
      const resolved = resolveTemplateFromDb(tpl, fallback);
      templateById.set(tpl.id, resolved);
      templateByKey.set(tpl.key, resolved);
    }

    if (brandAssignments.length > 0) {
      const assigned = new Map<string, ResolvedTemplate>();

      for (const assignment of brandAssignments) {
        const base =
          templateById.get(assignment.templateId) ??
          (assignment.template?.key ? templateByKey.get(assignment.template.key) : undefined);
        if (!base) continue;
        const merged: ResolvedTemplate = {
          ...base,
          config: mergeConfigs(base.config, assignment.configOverride ?? undefined),
        };
        assigned.set(merged.key, merged);
      }

      if (assigned.size > 0) {
        return sortTemplates(assigned.values());
      }
    }

    return sortTemplates(templateByKey.values());
  } catch (error) {
    console.warn("[templates] Failed to load templates", error);
    return [];
  }
}

export async function getTemplateByKey(key: string, brandId?: string | null): Promise<ResolvedTemplate> {
  const templates = await listTemplatesForBrand(brandId);
  const template = templates.find((t) => t.key === key);
  if (template) return template;

  const fallback = DEFAULT_TEMPLATES[key];
  if (fallback) return clone(fallback);

  throw new Error(`Unknown template key: ${key}`);
}
