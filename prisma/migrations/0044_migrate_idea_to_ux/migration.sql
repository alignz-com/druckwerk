-- Migrate existing IDEA category records to UX
UPDATE "Feature" SET "category" = 'UX' WHERE "category" = 'IDEA';

-- Remove old IDEA value from enum by recreating it
ALTER TABLE "Feature" ALTER COLUMN "category" DROP DEFAULT;
ALTER TYPE "FeatureCategory" RENAME TO "FeatureCategory_old";
CREATE TYPE "FeatureCategory" AS ENUM ('UI', 'UX', 'BACKEND', 'INFRASTRUCTURE', 'BUG');
ALTER TABLE "Feature" ALTER COLUMN "category" TYPE "FeatureCategory" USING "category"::text::"FeatureCategory";
ALTER TABLE "Feature" ALTER COLUMN "category" SET DEFAULT 'UX';
DROP TYPE "FeatureCategory_old";
