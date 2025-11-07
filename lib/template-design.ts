import { z } from "zod";

export type TemplateDesign = z.infer<typeof templateDesignSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type QrElement = z.infer<typeof qrElementSchema>;
export type StackElement = Extract<DesignElement, { type: "stack" }>;

export type TextPart = z.infer<typeof textPartSchema>;

const textPartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("literal"),
    value: z.string(),
    requires: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("binding"),
    field: z.string(),
    fallback: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
]);

const textFontSchema = z.object({
  sizePt: z.number().positive(),
  family: z.string().optional(),
  weight: z.number().optional(),
  color: z.string().optional(),
  style: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value.toLowerCase() === "italic" ? "italic" : "normal";
    }),
  baseline: z.enum(["hanging", "baseline"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(), // multiplier
  lineHeightMm: z.number().optional(),
});

const visibilitySchema = z
  .object({
    binding: z.string(),
    equals: z.string().optional(),
    notEmpty: z.boolean().optional(),
  })
  .optional();

const textElementSchema = z.object({
  type: z.literal("text"),
  xMm: z.number().optional().default(0),
  yMm: z.number().optional().default(0),
  maxWidthMm: z.number().optional(),
  parts: z.array(textPartSchema).optional(),
  binding: z.string().optional(),
  font: textFontSchema,
  textAnchor: z.enum(["start", "middle", "end"]).optional(),
  visibility: visibilitySchema,
});

const rectElementSchema = z.object({
  type: z.literal("rect"),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number(),
  heightMm: z.number(),
  fill: z.string().optional(),
  opacity: z.number().optional(),
  stroke: z.string().optional(),
  strokeWidthMm: z.number().optional(),
  radiusMm: z.number().optional(),
  visibility: visibilitySchema,
});

const qrElementSchema = z.object({
  type: z.literal("qr"),
  xMm: z.number(),
  yMm: z.number(),
  sizeMm: z.number(),
  dataBinding: z.string(), // expected base64 or url string field
  visibility: visibilitySchema,
});

const designElementSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("type", [
    textElementSchema,
    rectElementSchema,
    qrElementSchema,
    z.object({
      type: z.literal("stack"),
      xMm: z.number(),
      yMm: z.number(),
      gapMm: z.number().optional().default(0),
      items: z.array(designElementSchema).default([]),
      visibility: visibilitySchema,
      align: z.enum(["start", "center", "end"]).optional(),
    }),
  ]),
);

export const templateDesignSchema = z.object({
  version: z.number().int().default(1),
  front: z.array(designElementSchema).default([]),
  back: z.array(designElementSchema).default([]),
});

export function parseTemplateDesign(input: unknown): TemplateDesign {
  return templateDesignSchema.parse(input);
}

export function extractDesignFromConfigSource(config: unknown): TemplateDesign | null {
  if (config == null) return null;

  let candidate: unknown = config;
  if (typeof config === "string") {
    try {
      candidate = JSON.parse(config);
    } catch (error) {
      console.warn("[design] Failed to parse config JSON", error);
      return null;
    }
  }

  if (candidate && typeof candidate === "object") {
    const direct = tryParseDesign(candidate);
    if (direct) return direct;
    const nested = (candidate as any).design ?? (candidate as any).layout;
    if (nested) {
      const parsed = tryParseDesign(nested);
      if (parsed) return parsed;
    }
  }
  return null;
}

function looksLikeDesignStructure(input: unknown): input is { front?: unknown; back?: unknown } {
  if (!input || typeof input !== "object") return false;
  const candidate = input as { front?: unknown; back?: unknown };
  return Array.isArray(candidate.front) || Array.isArray(candidate.back);
}

function tryParseDesign(input: unknown): TemplateDesign | null {
  if (!looksLikeDesignStructure(input)) {
    return null;
  }
  try {
    return parseTemplateDesign(input);
  } catch (error) {
    console.warn("[design] Invalid inline design", error);
    return null;
  }
}

export function hasInlineDesignConfig(config: unknown): boolean {
  return extractDesignFromConfigSource(config) !== null;
}

export const DEFAULT_TEMPLATE_DESIGN: TemplateDesign = {
  version: 1,
  front: [],
  back: [],
};
