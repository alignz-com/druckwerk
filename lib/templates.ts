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

function buildDefaultTemplateMap() {
  const result = new Map<string, ResolvedTemplate>();
  for (const def of Object.values(DEFAULT_TEMPLATES)) {
    result.set(def.key, clone(def));
  }
  return result;
}

function sortTemplates(templates: Iterable<ResolvedTemplate>) {
  return Array.from(templates).sort((a, b) => a.label.localeCompare(b.label));
}

export async function listTemplatesForBrand(brandId?: string | null): Promise<ResolvedTemplate[]> {
  try {
    const result = buildDefaultTemplateMap();

    const [dbTemplates, brandTemplates] = await Promise.all([
      prisma.template.findMany(),
      brandId
        ? prisma.brandTemplate.findMany({
            where: { brandId },
            include: { template: true },
          })
        : Promise.resolve([]),
    ]);

    for (const tpl of dbTemplates) {
      const fallback = result.get(tpl.key);
      const baseConfig = fallback?.config ?? ((tpl.config ?? {}) as TemplateConfig);
      const merged: ResolvedTemplate = {
        id: tpl.id,
        key: tpl.key,
        label: tpl.label ?? fallback?.label ?? tpl.key,
        description: tpl.description ?? fallback?.description,
        pdfPath: tpl.pdfPath ?? fallback?.pdfPath ?? "",
        previewFrontPath: tpl.previewFrontPath ?? fallback?.previewFrontPath ?? "",
        previewBackPath: tpl.previewBackPath ?? fallback?.previewBackPath ?? "",
        config: mergeConfigs(baseConfig, tpl.config ?? undefined),
      };
      if (!merged.pdfPath) {
        throw new Error(`Template ${tpl.key} is missing pdfPath`);
      }
      result.set(tpl.key, merged);
    }

    for (const assignment of brandTemplates) {
      const templateKey = assignment.template?.key;
      if (!templateKey) continue;
      const current = result.get(templateKey) ?? clone(DEFAULT_TEMPLATES[templateKey]);
      if (!current) continue;
      const merged: ResolvedTemplate = {
        ...current,
        id: assignment.template?.id ?? current.id,
        config: mergeConfigs(current.config, assignment.configOverride ?? undefined),
      };
      result.set(templateKey, merged);
    }

    return sortTemplates(result.values());
  } catch (error) {
    console.warn("[templates] Falling back to default templates", error);
    return sortTemplates(buildDefaultTemplateMap().values());
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
