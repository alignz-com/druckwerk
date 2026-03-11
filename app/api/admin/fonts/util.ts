import { FontStyle } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const fontFamilySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  defaultWeight: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") {
          return null;
        }
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : value;
      },
      z.union([z.number().int().min(1).max(2000), z.null()]),
    )
    .optional(),
  defaultStyle: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") {
          return null;
        }
        if (typeof value === "string") {
          return value.trim().toUpperCase();
        }
        return value;
      },
      z.union([z.nativeEnum(FontStyle), z.null()]),
    )
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable(),
});

export type FontFamilyPayload = z.infer<typeof fontFamilySchema>;

export function slugifyFontFamily(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200) || "font"
  );
}

export async function ensureUniqueFontSlug(slug: string, excludeId?: string) {
  let candidate = slug;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.fontFamily.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    counter += 1;
    candidate = `${slug}-${counter}`.slice(0, 200);
  }
}
