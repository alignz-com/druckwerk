-- AlterTable
ALTER TABLE "Brand"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BrandAddress" (
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

-- AddForeignKey
ALTER TABLE "BrandAddress"
  ADD CONSTRAINT "BrandAddress_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BrandAddress_brandId_idx" ON "BrandAddress"("brandId");
