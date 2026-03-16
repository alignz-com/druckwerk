"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";
import { TEMPLATE_BUCKET } from "@/lib/s3";

type RouteParams = { templateId: string };

function parseLocalizedPositiveFloat(input: unknown): number | null {
  const normalized = String(input ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

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

  if (payload?.pageWidthMm !== undefined) {
    if (payload.pageWidthMm === null || payload.pageWidthMm === "") {
      updateData.pageWidthMm = null;
    } else {
      const parsed = parseLocalizedPositiveFloat(payload.pageWidthMm);
      if (parsed === null) {
        return NextResponse.json({ error: "pageWidthMm must be a positive number" }, { status: 400 });
      }
      updateData.pageWidthMm = parsed;
    }
  }

  if (payload?.pageHeightMm !== undefined) {
    if (payload.pageHeightMm === null || payload.pageHeightMm === "") {
      updateData.pageHeightMm = null;
    } else {
      const parsed = parseLocalizedPositiveFloat(payload.pageHeightMm);
      if (parsed === null) {
        return NextResponse.json({ error: "pageHeightMm must be a positive number" }, { status: 400 });
      }
      updateData.pageHeightMm = parsed;
    }
  }

  if (payload?.canvasWidthMm !== undefined) {
    if (payload.canvasWidthMm === null || payload.canvasWidthMm === "") {
      updateData.canvasWidthMm = null;
    } else {
      const parsed = parseLocalizedPositiveFloat(payload.canvasWidthMm);
      if (parsed === null) {
        return NextResponse.json({ error: "canvasWidthMm must be a positive number" }, { status: 400 });
      }
      updateData.canvasWidthMm = parsed;
    }
  }

  if (payload?.canvasHeightMm !== undefined) {
    if (payload.canvasHeightMm === null || payload.canvasHeightMm === "") {
      updateData.canvasHeightMm = null;
    } else {
      const parsed = parseLocalizedPositiveFloat(payload.canvasHeightMm);
      if (parsed === null) {
        return NextResponse.json({ error: "canvasHeightMm must be a positive number" }, { status: 400 });
      }
      updateData.canvasHeightMm = parsed;
    }
  }

  if (payload?.pcmCode !== undefined) {
    const value = payload.pcmCode === null ? "" : String(payload.pcmCode).trim();
    updateData.pcmCode = value.length > 0 ? value : null;
  }

  if (payload?.hasQrCode !== undefined) {
    const qrValue =
      typeof payload.hasQrCode === "string"
        ? payload.hasQrCode === "true" || payload.hasQrCode === "on"
        : Boolean(payload.hasQrCode);
    updateData.hasQrCode = qrValue;
  }

  if (payload?.hasPhotoSlot !== undefined) {
    const photoValue =
      typeof payload.hasPhotoSlot === "string"
        ? payload.hasPhotoSlot === "true" || payload.hasPhotoSlot === "on"
        : Boolean(payload.hasPhotoSlot);
    updateData.hasPhotoSlot = photoValue;
  }

  if (payload?.paperStockId !== undefined) {
    const value = payload.paperStockId === null ? "" : String(payload.paperStockId).trim();
    if (!value) {
      updateData.paperStock = { disconnect: true };
    } else {
      updateData.paperStock = { connect: { id: value } };
    }
  }

  if (payload?.productId !== undefined) {
    const value = payload.productId === null ? "" : String(payload.productId).trim();
    if (!value) {
      updateData.product = { disconnect: true };
    } else {
      updateData.product = { connect: { id: value } };
    }
  }

  if (payload?.productFormatId !== undefined) {
    const value = payload.productFormatId === null ? "" : String(payload.productFormatId).trim();
    if (!value) {
      updateData.productFormat = { disconnect: true };
    } else {
      updateData.productFormat = { connect: { id: value } };
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
