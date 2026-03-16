-- Phase 4: Drop legacy productId from PdfOrderItem, drop ProductPaperStock and BrandProductPaper tables

-- Drop legacy productId FK from PdfOrderItem
ALTER TABLE "PdfOrderItem" DROP COLUMN IF EXISTS "productId";

-- Drop legacy junction tables replaced by ProductFormatPaper and BrandProductFormatPreference
DROP TABLE IF EXISTS "ProductPaperStock";
DROP TABLE IF EXISTS "BrandProductPaper";
