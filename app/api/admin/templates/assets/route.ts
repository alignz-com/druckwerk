import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, TemplateAssetType } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractPdfMetadata,
  extractPngMetadata,
  getTemplateAssetPublicUrl,
  uploadTemplateAsset,
} from "@/lib/storage";

const TEMPLATE_ASSET_TYPE_MAP: Record<string, TemplateAssetType> = {
  pdf: TemplateAssetType.PDF,
  preview_front: TemplateAssetType.PREVIEW_FRONT,
  preview_back: TemplateAssetType.PREVIEW_BACK,
  config: TemplateAssetType.CONFIG,
};

function resolveTemplateAssetType(input: FormDataEntryValue | null): TemplateAssetType {
  if (!input) return TemplateAssetType.OTHER;
  const key = String(input).trim().toLowerCase();
  return TEMPLATE_ASSET_TYPE_MAP[key] ?? TemplateAssetType.OTHER;
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const templateKey = String(form.get("templateKey") ?? "").trim();
  if (!templateKey) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({ where: { key: templateKey } });
  if (!template) {
    return NextResponse.json({ error: `Template with key "${templateKey}" not found` }, { status: 404 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const versionRaw = String(form.get("version") ?? "1").trim();
  const version = Number.parseInt(versionRaw, 10);
  if (!Number.isFinite(version) || version < 1) {
    return NextResponse.json({ error: "version must be a positive integer" }, { status: 400 });
  }

  const type = resolveTemplateAssetType(form.get("assetType"));
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const checksum = createHash("sha256").update(data).digest("hex");
  const fileName = file.name || `${type.toLowerCase()}.${guessExtension(file.type)}`;
  const contentType = file.type || guessContentType(file.name);

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

  let parsedConfig: unknown | null = null;
  if (type === TemplateAssetType.CONFIG) {
    try {
      parsedConfig = JSON.parse(new TextDecoder().decode(data));
    } catch {
      return NextResponse.json({ error: "config must be valid JSON" }, { status: 400 });
    }
  }

  const asset = await prisma.templateAsset.create({
    data: {
      templateId: template.id,
      type,
      storageKey: upload.storageKey,
      mimeType: contentType,
      fileName,
      checksum,
      version,
      sizeBytes: upload.sizeBytes ?? data.byteLength,
    },
  });

  let templateUpdate: Prisma.TemplateUpdateInput | null = null;
  const publicUrl = getTemplateAssetPublicUrl(upload.storageKey);
  let pdfMeta: Awaited<ReturnType<typeof extractPdfMetadata>> | null = null;

  if (type === TemplateAssetType.PDF) {
    pdfMeta = await extractPdfMetadata(data);
    templateUpdate = {
      pdfPath: publicUrl,
      canvasWidthMm: pdfMeta.widthMm,
      canvasHeightMm: pdfMeta.heightMm,
      pageWidthMm: pdfMeta.trimWidthMm ?? pdfMeta.widthMm,
      pageHeightMm: pdfMeta.trimHeightMm ?? pdfMeta.heightMm,
      spotColors: pdfMeta.spotColors.length > 0 ? pdfMeta.spotColors : undefined,
    };
  } else if (type === TemplateAssetType.PREVIEW_FRONT) {
    templateUpdate = { previewFrontPath: publicUrl };
  } else if (type === TemplateAssetType.PREVIEW_BACK) {
    templateUpdate = { previewBackPath: publicUrl };
  } else if (type === TemplateAssetType.CONFIG && parsedConfig !== null) {
    templateUpdate = { config: parsedConfig };
  }

  if (templateUpdate) {
    await prisma.template.update({
      where: { id: template.id },
      data: templateUpdate,
    });
  }

  let metadata: Record<string, unknown> | null = null;
  if (type === TemplateAssetType.PDF && pdfMeta) {
    metadata = {
      pageCount: pdfMeta.pageCount,
      widthMm: pdfMeta.widthMm,
      heightMm: pdfMeta.heightMm,
      widthPt: pdfMeta.widthPt,
      heightPt: pdfMeta.heightPt,
      trimWidthMm: pdfMeta.trimWidthMm,
      trimHeightMm: pdfMeta.trimHeightMm,
      spotColors: pdfMeta.spotColors,
    };
  } else if (
    type === TemplateAssetType.PREVIEW_FRONT ||
    type === TemplateAssetType.PREVIEW_BACK ||
    type === TemplateAssetType.CONFIG
  ) {
    try {
      const pngMeta = extractPngMetadata(data);
      metadata = {
        widthPx: pngMeta.widthPx,
        heightPx: pngMeta.heightPx,
        dpiX: pngMeta.dpiX ?? null,
        dpiY: pngMeta.dpiY ?? null,
        widthMm: pngMeta.widthMm ?? null,
        heightMm: pngMeta.heightMm ?? null,
      };
    } catch {
      metadata = null;
    }
  }

  return NextResponse.json({
    asset,
    publicUrl,
    metadata,
  });
}

function guessExtension(contentType: string) {
  switch (contentType) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/svg+xml":
      return "svg";
    case "application/json":
      return "json";
    default:
      return "bin";
  }
}

function guessContentType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
