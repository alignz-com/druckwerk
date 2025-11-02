ALTER TABLE "Template"
  ADD COLUMN "pdfPath" TEXT,
  ADD COLUMN "previewFrontPath" TEXT,
  ADD COLUMN "previewBackPath" TEXT,
  ADD COLUMN "config" JSONB;

UPDATE "Template"
SET
  "pdfPath" = COALESCE("pdfPath", 'templates/omicron.pdf'),
  "config" = COALESCE("config", '{}'::jsonb);

ALTER TABLE "Template"
  ALTER COLUMN "pdfPath" SET NOT NULL,
  ALTER COLUMN "config" SET NOT NULL;

ALTER TABLE "BrandTemplate"
  ADD COLUMN "configOverride" JSONB;
