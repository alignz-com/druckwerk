ALTER TABLE "Template"
  ADD COLUMN IF NOT EXISTS "pdfPath" TEXT,
  ADD COLUMN IF NOT EXISTS "previewFrontPath" TEXT,
  ADD COLUMN IF NOT EXISTS "previewBackPath" TEXT,
  ADD COLUMN IF NOT EXISTS "config" JSONB;

UPDATE "Template"
SET
  "pdfPath" = COALESCE("pdfPath", 'templates/omicron.pdf'),
  "config" = COALESCE("config", '{}'::jsonb)
WHERE "pdfPath" IS NULL OR "config" IS NULL;

ALTER TABLE "Template"
  ALTER COLUMN "pdfPath" SET NOT NULL,
  ALTER COLUMN "config" SET NOT NULL;

ALTER TABLE "BrandTemplate"
  ADD COLUMN IF NOT EXISTS "configOverride" JSONB;
