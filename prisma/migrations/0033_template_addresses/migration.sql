CREATE TABLE IF NOT EXISTS "TemplateAddress" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "brandAddressId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TemplateAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TemplateAddress_templateId_brandAddressId_key"
  ON "TemplateAddress"("templateId", "brandAddressId");

CREATE INDEX IF NOT EXISTS "TemplateAddress_templateId_idx"
  ON "TemplateAddress"("templateId");

CREATE INDEX IF NOT EXISTS "TemplateAddress_brandAddressId_idx"
  ON "TemplateAddress"("brandAddressId");

ALTER TABLE "TemplateAddress"
  ADD CONSTRAINT "TemplateAddress_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateAddress"
  ADD CONSTRAINT "TemplateAddress_brandAddressId_fkey"
  FOREIGN KEY ("brandAddressId") REFERENCES "BrandAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
