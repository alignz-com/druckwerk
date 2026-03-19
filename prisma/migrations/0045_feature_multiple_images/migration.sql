-- Migrate imageUrl to imageUrls array
ALTER TABLE "Feature" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Copy existing imageUrl values into imageUrls array
UPDATE "Feature" SET "imageUrls" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;

-- Drop old column
ALTER TABLE "Feature" DROP COLUMN "imageUrl";
