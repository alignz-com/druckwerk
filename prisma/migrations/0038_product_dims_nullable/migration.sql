-- Make legacy Product dimension columns nullable (dimensions now live on Format model)
ALTER TABLE "Product" ALTER COLUMN "trimWidthMm" DROP NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "trimHeightMm" DROP NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "toleranceMm" DROP NOT NULL;
