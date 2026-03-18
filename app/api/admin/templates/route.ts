"use server";

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, TemplateAssetType } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";
import { getTemplateAssetPublicUrl, uploadTemplateAsset } from "@/lib/storage";

function parseLocalizedPositiveFloat(input: unknown): number | null {
  const normalized = String(input ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const key = String(form.get("key") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const descriptionRaw = form.get("description");
  const pcmCodeRaw = form.get("pcmCode");
  const description =
    descriptionRaw === null || String(descriptionRaw).trim().length === 0 ? null : String(descriptionRaw).trim();
  const pcmCodeValue =
    pcmCodeRaw === null || pcmCodeRaw === undefined
      ? null
      : (() => {
          const value = String(pcmCodeRaw).trim();
          return value.length > 0 ? value : null;
        })();
  const layoutVersionRaw = form.get("layoutVersion");
  const printDpiRaw = form.get("printDpi");
  const pageWidthMmRaw = form.get("pageWidthMm");
  const pageHeightMmRaw = form.get("pageHeightMm");
  const canvasWidthMmRaw = form.get("canvasWidthMm");
  const canvasHeightMmRaw = form.get("canvasHeightMm");
  const paperStockIdRaw = form.get("paperStockId");
  const brandIdRaw = form.get("brandId");
  const configRaw = form.get("config");
  const pdfFile = form.get("pdfFile");
  const previewFrontFile = form.get("previewFrontFile");
  const previewBackFile = form.get("previewBackFile");
  const hasQrCodeRaw = form.get("hasQrCode");
  const hasQrCode =
    typeof hasQrCodeRaw === "string"
      ? hasQrCodeRaw === "true" || hasQrCodeRaw === "on"
      : hasQrCodeRaw === null
        ? false
        : Boolean(hasQrCodeRaw);
  const hasPhotoSlotRaw = form.get("hasPhotoSlot");
  const hasPhotoSlot =
    typeof hasPhotoSlotRaw === "string"
      ? hasPhotoSlotRaw === "true" || hasPhotoSlotRaw === "on"
      : hasPhotoSlotRaw === null
        ? false
        : Boolean(hasPhotoSlotRaw);

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  if (!/^[a-z0-9._-]+$/i.test(key)) {
    return NextResponse.json({ error: "key must only contain letters, digits, dot, dash, or underscore" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  let layoutVersion: number | null = null;
  if (layoutVersionRaw !== undefined && layoutVersionRaw !== null && String(layoutVersionRaw).trim() !== "") {
    const parsed = Number.parseInt(String(layoutVersionRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "layoutVersion must be a non-negative integer" }, { status: 400 });
    }
    layoutVersion = parsed;
  }

  let printDpi: number | null = null;
  if (printDpiRaw !== undefined && printDpiRaw !== null && String(printDpiRaw).trim() !== "") {
    const parsed = Number.parseInt(String(printDpiRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "printDpi must be a non-negative integer" }, { status: 400 });
    }
    printDpi = parsed;
  }

  let pageWidthMm: number | null = null;
  if (pageWidthMmRaw !== undefined && pageWidthMmRaw !== null && String(pageWidthMmRaw).trim() !== "") {
    const parsed = parseLocalizedPositiveFloat(pageWidthMmRaw);
    if (parsed === null) {
      return NextResponse.json({ error: "pageWidthMm must be a positive number" }, { status: 400 });
    }
    pageWidthMm = parsed;
  }

  let pageHeightMm: number | null = null;
  if (pageHeightMmRaw !== undefined && pageHeightMmRaw !== null && String(pageHeightMmRaw).trim() !== "") {
    const parsed = parseLocalizedPositiveFloat(pageHeightMmRaw);
    if (parsed === null) {
      return NextResponse.json({ error: "pageHeightMm must be a positive number" }, { status: 400 });
    }
    pageHeightMm = parsed;
  }

  let canvasWidthMm: number | null = null;
  if (canvasWidthMmRaw !== undefined && canvasWidthMmRaw !== null && String(canvasWidthMmRaw).trim() !== "") {
    const parsed = parseLocalizedPositiveFloat(canvasWidthMmRaw);
    if (parsed === null) {
      return NextResponse.json({ error: "canvasWidthMm must be a positive number" }, { status: 400 });
    }
    canvasWidthMm = parsed;
  }

  let canvasHeightMm: number | null = null;
  if (canvasHeightMmRaw !== undefined && canvasHeightMmRaw !== null && String(canvasHeightMmRaw).trim() !== "") {
    const parsed = parseLocalizedPositiveFloat(canvasHeightMmRaw);
    if (parsed === null) {
      return NextResponse.json({ error: "canvasHeightMm must be a positive number" }, { status: 400 });
    }
    canvasHeightMm = parsed;
  }

  let config: Prisma.InputJsonValue | Prisma.JsonNullValueInput = {};
  if (typeof configRaw === "string") {
    try {
      const parsed = JSON.parse(configRaw);
      config = parsed === null ? Prisma.JsonNull : (parsed as Prisma.InputJsonValue);
    } catch {
      return NextResponse.json({ error: "config must be valid JSON" }, { status: 400 });
    }
  } else if (configRaw && typeof configRaw === "object") {
    return NextResponse.json({ error: "config must be provided as JSON string" }, { status: 400 });
  }

  const pdfUpload = pdfFile instanceof File ? pdfFile : null;
  const previewFrontUpload = previewFrontFile instanceof File ? previewFrontFile : null;
  const previewBackUpload = previewBackFile instanceof File ? previewBackFile : null;

  const paperStockId =
    paperStockIdRaw === null || paperStockIdRaw === undefined ? "" : String(paperStockIdRaw).trim();
  const brandId =
    brandIdRaw === null || brandIdRaw === undefined ? "" : String(brandIdRaw).trim();

  if (brandId) {
    const brandExists = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brandExists) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
  }

  try {
    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          key,
          label,
          description,
          pdfPath: "",
          previewFrontPath: "",
          previewBackPath: "",
          layoutVersion,
          printDpi,
          pageWidthMm,
          pageHeightMm,
          canvasWidthMm,
          canvasHeightMm,
          pcmCode: pcmCodeValue,
          config,
          hasQrCode,
          hasPhotoSlot,
          paperStock: paperStockId ? { connect: { id: paperStockId } } : undefined,
        },
      });

      if (brandId) {
        await tx.brandTemplate.create({
          data: {
            brandId,
            templateId: created.id,
          },
        });
      }

      return created;
    });

    const updateData: Prisma.TemplateUpdateInput = {};

    if (pdfUpload) {
      const { publicUrl } = await uploadInitialAsset(template.id, key, pdfUpload, TemplateAssetType.PDF, 1);
      updateData.pdfPath = publicUrl;
    }

    if (previewFrontUpload) {
      const { publicUrl } = await uploadInitialAsset(
        template.id,
        key,
        previewFrontUpload,
        TemplateAssetType.PREVIEW_FRONT,
        1,
      );
      updateData.previewFrontPath = publicUrl;
    }

    if (previewBackUpload) {
      const { publicUrl } = await uploadInitialAsset(
        template.id,
        key,
        previewBackUpload,
        TemplateAssetType.PREVIEW_BACK,
        1,
      );
      updateData.previewBackPath = publicUrl;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.template.update({
        where: { id: template.id },
        data: updateData,
      });
    }

    const hydrated = await prisma.template.findUnique({
      where: { id: template.id },
      include: adminTemplateSummaryInclude,
    });

    if (!hydrated) {
      throw new Error("Template creation failed");
    }

    return NextResponse.json(
      {
        templateId: hydrated.id,
        template: mapTemplateToAdminSummary(hydrated),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A template with this key already exists" }, { status: 409 });
    }
    console.error("[admin] create template failed", error);
    return NextResponse.json({ error: "Template creation failed" }, { status: 500 });
  }
}

async function uploadInitialAsset(
  templateId: string,
  templateKey: string,
  file: File,
  type: TemplateAssetType,
  version: number,
) {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const checksum = createHash("sha256").update(data).digest("hex");
  const fileName = file.name || defaultFileName(type, file.type);
  const contentType = file.type || guessContentType(fileName);

  const upload = await uploadTemplateAsset(
    {
      templateKey,
      version,
      type,
      fileName,
      data,
      contentType,
    },
    { upsert: true },
  );

  await prisma.templateAsset.create({
    data: {
      templateId,
      type,
      storageKey: upload.storageKey,
      mimeType: contentType,
      fileName,
      checksum,
      version,
      sizeBytes: upload.sizeBytes ?? data.byteLength,
    },
  });

  const publicUrl = getTemplateAssetPublicUrl(upload.storageKey);
  return { publicUrl };
}

function defaultFileName(type: TemplateAssetType, mimeType: string) {
  if (type === TemplateAssetType.PDF) return "template.pdf";
  if (type === TemplateAssetType.PREVIEW_FRONT) return "preview-front.png";
  if (type === TemplateAssetType.PREVIEW_BACK) return "preview-back.png";
  if (type === TemplateAssetType.CONFIG) return "config.json";
  return mimeType.startsWith("image/") ? "asset.png" : "asset.bin";
}

function guessContentType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
