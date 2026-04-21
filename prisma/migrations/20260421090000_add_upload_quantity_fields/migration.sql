-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "uploadQuantityMin" INTEGER;
ALTER TABLE "Brand" ADD COLUMN "uploadQuantityMax" INTEGER;
ALTER TABLE "Brand" ADD COLUMN "uploadQuantityStep" INTEGER;
ALTER TABLE "Brand" ADD COLUMN "uploadQuantityOptions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
