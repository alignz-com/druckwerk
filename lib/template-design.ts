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
  }),
  z.object({
    type: z.literal("binding"),
    field: z.string(),
    fallback: z.string().optional(),
  }),
]);

const textFontSchema = z.object({
  sizePt: z.number().positive(),
  weight: z.number().optional(),
  color: z.string().optional(),
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

export const DEFAULT_TEMPLATE_DESIGN: TemplateDesign = {
  version: 1,
  front: [],
  back: [],
};
