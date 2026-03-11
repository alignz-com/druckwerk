-- CreateEnum
CREATE TYPE "TemplateAssetType" AS ENUM ('PDF', 'PREVIEW_FRONT', 'PREVIEW_BACK', 'CONFIG', 'OTHER');

-- CreateEnum
CREATE TYPE "FontStyle" AS ENUM ('NORMAL', 'ITALIC');

-- CreateEnum
CREATE TYPE "FontFormat" AS ENUM ('TTF', 'OTF', 'WOFF', 'WOFF2');

-- AlterTable
ALTER TABLE "Template"
  ADD COLUMN "layoutVersion" INTEGER,
  ADD COLUMN "printDpi" INTEGER;

-- CreateTable
CREATE TABLE "TemplateAsset" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "TemplateAssetType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FontFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultWeight" INTEGER DEFAULT 400,
    "defaultStyle" "FontStyle" DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FontFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FontVariant" (
    "id" TEXT NOT NULL,
    "fontFamilyId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 400,
    "style" "FontStyle" NOT NULL DEFAULT 'NORMAL',
    "format" "FontFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT,
    "postscriptName" TEXT,
    "checksum" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FontVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateFont" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "fontVariantId" TEXT NOT NULL,
    "usage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateFont_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateAsset_templateId_idx" ON "TemplateAsset"("templateId");

-- CreateIndex
CREATE INDEX "TemplateAsset_templateId_type_idx" ON "TemplateAsset"("templateId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FontFamily_name_key" ON "FontFamily"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FontFamily_slug_key" ON "FontFamily"("slug");

-- CreateIndex
CREATE INDEX "FontVariant_fontFamilyId_idx" ON "FontVariant"("fontFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "FontVariant_fontFamilyId_weight_style_format_key" ON "FontVariant"("fontFamilyId", "weight", "style", "format");

-- CreateIndex
CREATE INDEX "TemplateFont_fontVariantId_idx" ON "TemplateFont"("fontVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFont_templateId_fontVariantId_key" ON "TemplateFont"("templateId", "fontVariantId");

-- AddForeignKey
ALTER TABLE "TemplateAsset" ADD CONSTRAINT "TemplateAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontVariant" ADD CONSTRAINT "FontVariant_fontFamilyId_fkey" FOREIGN KEY ("fontFamilyId") REFERENCES "FontFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFont" ADD CONSTRAINT "TemplateFont_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFont" ADD CONSTRAINT "TemplateFont_fontVariantId_fkey" FOREIGN KEY ("fontVariantId") REFERENCES "FontVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
