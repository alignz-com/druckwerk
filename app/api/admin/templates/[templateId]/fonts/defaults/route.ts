"use server";

import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";

type RouteParams = { templateId: string };
type FontSlot = "regular" | "bold" | "italic" | "boldItalic";
const FONT_SLOTS: FontSlot[] = ["regular", "bold", "italic", "boldItalic"];

export async function PATCH(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: Partial<Record<FontSlot, string | null>>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = FONT_SLOTS.filter((slot) => Object.prototype.hasOwnProperty.call(payload, slot)).map((slot) => {
    const raw = payload[slot];
    return {
      slot,
      variantId: typeof raw === "string" ? raw.trim() : "",
    };
  });

  if (updates.length === 0) {
    return NextResponse.json({ error: "No slots provided" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const { slot, variantId } of updates) {
        await tx.templateFont.updateMany({
          where: { templateId, usage: slot },
          data: { usage: null },
        });

        if (variantId) {
          const link = await tx.templateFont.findFirst({
            where: { templateId, fontVariantId: variantId },
            select: { id: true },
          });
          if (!link) {
            throw new Error(`Font variant ${variantId} is not linked to this template`);
          }
          await tx.templateFont.update({
            where: { id: link.id },
            data: { usage: slot },
          });
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update font defaults";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.template.findUnique({
    where: { id: templateId },
    include: adminTemplateSummaryInclude,
  });
  if (!updated) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: mapTemplateToAdminSummary(updated) });
}
