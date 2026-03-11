-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'PRINTER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TemplateAssetType" AS ENUM ('PDF', 'PREVIEW_FRONT', 'PREVIEW_BACK', 'CONFIG', 'OTHER');

-- CreateEnum
CREATE TYPE "FontStyle" AS ENUM ('NORMAL', 'ITALIC');

-- CreateEnum
CREATE TYPE "FontFormat" AS ENUM ('TTF', 'OTF', 'WOFF', 'WOFF2');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "jobTitle" TEXT,
    "department" TEXT,
    "mobilePhone" TEXT,
    "businessPhone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "hashedPassword" TEXT,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "extExpiresIn" INTEGER,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificationTokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAddress" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "label" TEXT,
    "company" TEXT,
    "street" TEXT,
    "addressExtra" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandDomain" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "pdfPath" TEXT NOT NULL,
    "previewFrontPath" TEXT,
    "previewBackPath" TEXT,
    "config" JSONB NOT NULL,
    "layoutVersion" INTEGER,
    "printDpi" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTemplate" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configOverride" JSONB,

    CONSTRAINT "BrandTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "templateId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "quantity" INTEGER NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterRole" TEXT,
    "requesterEmail" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "company" TEXT,
    "url" TEXT,
    "linkedin" TEXT,
    "pdfUrl" TEXT,
    "blobId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verificationTokens_token_key" ON "verificationTokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verificationTokens_identifier_token_key" ON "verificationTokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "BrandAddress_brandId_idx" ON "BrandAddress"("brandId");

-- CreateIndex
CREATE INDEX "BrandDomain_domain_idx" ON "BrandDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "BrandDomain_brandId_domain_key" ON "BrandDomain"("brandId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTemplate_brandId_templateId_key" ON "BrandTemplate"("brandId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_referenceCode_key" ON "Order"("referenceCode");

-- CreateIndex
CREATE INDEX "Order_brandId_idx" ON "Order"("brandId");

-- CreateIndex
CREATE INDEX "Order_templateId_idx" ON "Order"("templateId");

-- CreateIndex
CREATE INDEX "TemplateAsset_templateId_idx" ON "TemplateAsset"("templateId");

-- CreateIndex
CREATE INDEX "TemplateAsset_templateId_type_idx" ON "TemplateAsset"("templateId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FontFamily_slug_key" ON "FontFamily"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FontFamily_name_key" ON "FontFamily"("name");

-- CreateIndex
CREATE INDEX "FontVariant_fontFamilyId_idx" ON "FontVariant"("fontFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "FontVariant_fontFamilyId_weight_style_format_key" ON "FontVariant"("fontFamilyId", "weight", "style", "format");

-- CreateIndex
CREATE INDEX "TemplateFont_fontVariantId_idx" ON "TemplateFont"("fontVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFont_templateId_fontVariantId_key" ON "TemplateFont"("templateId", "fontVariantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAddress" ADD CONSTRAINT "BrandAddress_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDomain" ADD CONSTRAINT "BrandDomain_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplate" ADD CONSTRAINT "BrandTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplate" ADD CONSTRAINT "BrandTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAsset" ADD CONSTRAINT "TemplateAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontVariant" ADD CONSTRAINT "FontVariant_fontFamilyId_fkey" FOREIGN KEY ("fontFamilyId") REFERENCES "FontFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFont" ADD CONSTRAINT "TemplateFont_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFont" ADD CONSTRAINT "TemplateFont_fontVariantId_fkey" FOREIGN KEY ("fontVariantId") REFERENCES "FontVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

