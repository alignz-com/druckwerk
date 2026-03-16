-- AlterTable
ALTER TABLE "PdfOrderItem" ADD COLUMN     "contentPaperStockId" TEXT,
ADD COLUMN     "coverPaperStockId" TEXT,
ADD COLUMN     "finishId" TEXT,
ADD COLUMN     "productFormatId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "productFormatId" TEXT;

-- CreateTable
CREATE TABLE "Format" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameDe" TEXT,
    "slug" TEXT NOT NULL,
    "trimWidthMm" DOUBLE PRECISION NOT NULL,
    "trimHeightMm" DOUBLE PRECISION NOT NULL,
    "defaultBleedMm" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "toleranceMm" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFormat" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "pcmCode" TEXT,
    "printDpi" INTEGER,
    "canvasWidthMm" DOUBLE PRECISION,
    "canvasHeightMm" DOUBLE PRECISION,
    "productionSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minPages" INTEGER,
    "maxPages" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFormatPaper" (
    "id" TEXT NOT NULL,
    "productFormatId" TEXT NOT NULL,
    "paperStockId" TEXT NOT NULL,
    "role" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFormatPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameDe" TEXT,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFormatFinish" (
    "id" TEXT NOT NULL,
    "productFormatId" TEXT NOT NULL,
    "finishId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFormatFinish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProductFormatPreference" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "productFormatId" TEXT NOT NULL,
    "coverPaperStockId" TEXT,
    "contentPaperStockId" TEXT,
    "finishId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProductFormatPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Format_slug_key" ON "Format"("slug");

-- CreateIndex
CREATE INDEX "ProductFormat_productId_idx" ON "ProductFormat"("productId");

-- CreateIndex
CREATE INDEX "ProductFormat_formatId_idx" ON "ProductFormat"("formatId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFormat_productId_formatId_key" ON "ProductFormat"("productId", "formatId");

-- CreateIndex
CREATE INDEX "ProductFormatPaper_productFormatId_idx" ON "ProductFormatPaper"("productFormatId");

-- CreateIndex
CREATE INDEX "ProductFormatFinish_productFormatId_idx" ON "ProductFormatFinish"("productFormatId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFormatFinish_productFormatId_finishId_key" ON "ProductFormatFinish"("productFormatId", "finishId");

-- CreateIndex
CREATE INDEX "BrandProductFormatPreference_brandId_idx" ON "BrandProductFormatPreference"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProductFormatPreference_brandId_productFormatId_key" ON "BrandProductFormatPreference"("brandId", "productFormatId");

-- CreateIndex
CREATE INDEX "PdfOrderItem_productFormatId_idx" ON "PdfOrderItem"("productFormatId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_productFormatId_fkey" FOREIGN KEY ("productFormatId") REFERENCES "ProductFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfOrderItem" ADD CONSTRAINT "PdfOrderItem_productFormatId_fkey" FOREIGN KEY ("productFormatId") REFERENCES "ProductFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfOrderItem" ADD CONSTRAINT "PdfOrderItem_coverPaperStockId_fkey" FOREIGN KEY ("coverPaperStockId") REFERENCES "PaperStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfOrderItem" ADD CONSTRAINT "PdfOrderItem_contentPaperStockId_fkey" FOREIGN KEY ("contentPaperStockId") REFERENCES "PaperStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfOrderItem" ADD CONSTRAINT "PdfOrderItem_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormat" ADD CONSTRAINT "ProductFormat_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormat" ADD CONSTRAINT "ProductFormat_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormatPaper" ADD CONSTRAINT "ProductFormatPaper_productFormatId_fkey" FOREIGN KEY ("productFormatId") REFERENCES "ProductFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormatPaper" ADD CONSTRAINT "ProductFormatPaper_paperStockId_fkey" FOREIGN KEY ("paperStockId") REFERENCES "PaperStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormatFinish" ADD CONSTRAINT "ProductFormatFinish_productFormatId_fkey" FOREIGN KEY ("productFormatId") REFERENCES "ProductFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFormatFinish" ADD CONSTRAINT "ProductFormatFinish_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFormatPreference" ADD CONSTRAINT "BrandProductFormatPreference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFormatPreference" ADD CONSTRAINT "BrandProductFormatPreference_productFormatId_fkey" FOREIGN KEY ("productFormatId") REFERENCES "ProductFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFormatPreference" ADD CONSTRAINT "BrandProductFormatPreference_coverPaperStockId_fkey" FOREIGN KEY ("coverPaperStockId") REFERENCES "PaperStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFormatPreference" ADD CONSTRAINT "BrandProductFormatPreference_contentPaperStockId_fkey" FOREIGN KEY ("contentPaperStockId") REFERENCES "PaperStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFormatPreference" ADD CONSTRAINT "BrandProductFormatPreference_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

