-- AlterTable
ALTER TABLE "ProductFormatPaper" ADD COLUMN "pcmCode" TEXT;

-- CreateTable
CREATE TABLE "BrandPaper" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "paperStockId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandPaper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandPaper_brandId_idx" ON "BrandPaper"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandPaper_brandId_paperStockId_key" ON "BrandPaper"("brandId", "paperStockId");

-- AddForeignKey
ALTER TABLE "BrandPaper" ADD CONSTRAINT "BrandPaper_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPaper" ADD CONSTRAINT "BrandPaper_paperStockId_fkey" FOREIGN KEY ("paperStockId") REFERENCES "PaperStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
