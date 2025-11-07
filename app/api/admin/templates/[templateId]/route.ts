"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";

const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";

type RouteParams = { templateId: string };

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

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updateData: Prisma.TemplateUpdateInput = {};

  if (payload?.label !== undefined) {
    const label = String(payload.label).trim();
    if (!label) {
      return NextResponse.json({ error: "label must not be empty" }, { status: 400 });
    }
    updateData.label = label;
  }

  if (payload?.description !== undefined) {
    const description = String(payload.description).trim();
    updateData.description = description.length > 0 ? description : null;
  }

  if (payload?.layoutVersion !== undefined) {
    if (payload.layoutVersion === null || payload.layoutVersion === "") {
      updateData.layoutVersion = null;
    } else {
      const parsed = Number.parseInt(String(payload.layoutVersion), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json({ error: "layoutVersion must be a non-negative integer" }, { status: 400 });
      }
      updateData.layoutVersion = parsed;
    }
  }

  if (payload?.printDpi !== undefined) {
    if (payload.printDpi === null || payload.printDpi === "") {
      updateData.printDpi = null;
    } else {
      const parsed = Number.parseInt(String(payload.printDpi), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json({ error: "printDpi must be a non-negative integer" }, { status: 400 });
      }
      updateData.printDpi = parsed;
    }
  }

  if (payload?.paperStockId !== undefined) {
    const value = payload.paperStockId === null ? "" : String(payload.paperStockId).trim();
    if (!value) {
      updateData.paperStock = { disconnect: true };
    } else {
      updateData.paperStock = { connect: { id: value } };
    }
  }

  if (payload?.config !== undefined) {
    if (payload.config === null || typeof payload.config !== "object") {
      return NextResponse.json({ error: "config must be an object" }, { status: 400 });
    }
    updateData.config = payload.config;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  try {
    const template = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
      include: adminTemplateSummaryInclude,
    });

    return NextResponse.json({
      template: mapTemplateToAdminSummary(template),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    console.error("[admin] update template failed", error);
    return NextResponse.json({ error: "Template update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { assets: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    await prisma.template.delete({
      where: { id: templateId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Template kann nicht gelöscht werden, weil noch Bestellungen oder Zuweisungen darauf verweisen. Bitte entferne diese zuerst.",
        },
        { status: 409 },
      );
    }
    console.error("[admin] delete template failed", error);
    return NextResponse.json({ error: "Template deletion failed" }, { status: 500 });
  }

  // best effort cleanup of storage assets
  const keys = template.assets.map((asset) => asset.storageKey).filter(Boolean);
  await Promise.allSettled(keys.map((key) => deleteObject(TEMPLATE_BUCKET, key).catch(() => undefined)));

  return NextResponse.json({ success: true });
}
