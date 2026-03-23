-- Rename OrderType enum values
ALTER TYPE "OrderType" RENAME VALUE 'BUSINESS_CARD' TO 'TEMPLATE';
ALTER TYPE "OrderType" RENAME VALUE 'PDF_PRINT' TO 'UPLOAD';

-- Rename ProductType enum values
ALTER TYPE "ProductType" RENAME VALUE 'BUSINESS_CARD' TO 'TEMPLATE';
ALTER TYPE "ProductType" RENAME VALUE 'PDF_PRINT' TO 'UPLOAD';

-- Rename User permission columns
ALTER TABLE "User" RENAME COLUMN "canOrderBusinessCards" TO "canUseTemplates";
ALTER TABLE "User" RENAME COLUMN "canOrderPdfPrint" TO "canUploadFiles";

-- Rename Brand permission columns
ALTER TABLE "Brand" RENAME COLUMN "canOrderBusinessCards" TO "canUseTemplates";
ALTER TABLE "Brand" RENAME COLUMN "canOrderPdfPrint" TO "canUploadFiles";
