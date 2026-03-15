-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "azureTenantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_azureTenantId_key" ON "Brand"("azureTenantId");
