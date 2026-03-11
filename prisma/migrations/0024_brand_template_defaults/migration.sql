ALTER TABLE "Brand" ADD COLUMN "defaultTemplateId" TEXT;

ALTER TABLE "BrandTemplate" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "brandId" ORDER BY "assignedAt", "id") - 1 AS rn
  FROM "BrandTemplate"
)
UPDATE "BrandTemplate" AS bt
SET "orderIndex" = ranked.rn
FROM ranked
WHERE ranked.id = bt.id;

ALTER TABLE "Brand" ADD CONSTRAINT "Brand_defaultTemplateId_fkey"
  FOREIGN KEY ("defaultTemplateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BrandTemplate_brandId_orderIndex_idx" ON "BrandTemplate" ("brandId", "orderIndex");
