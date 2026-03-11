DO $$ BEGIN
  CREATE TYPE "BrandQrMode" AS ENUM ('VCARD_ONLY', 'PUBLIC_PROFILE_ONLY', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "qrMode" "BrandQrMode" NOT NULL DEFAULT 'VCARD_ONLY';
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "defaultQrMode" "BrandQrMode";

CREATE TABLE IF NOT EXISTS "BrandPublicDomain" (
  "id" TEXT PRIMARY KEY,
  "brandId" TEXT NOT NULL,
  "domain" TEXT NOT NULL UNIQUE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "BrandPublicDomain_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BrandPublicDomain_brandId_isPrimary_idx" ON "BrandPublicDomain"("brandId", "isPrimary");

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT PRIMARY KEY,
  "publicId" TEXT NOT NULL UNIQUE,
  "brandId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "title" TEXT,
  "department" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "mobile" TEXT,
  "website" TEXT,
  "linkedin" TEXT,
  "photoUrl" TEXT,
  "addressId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "Contact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Contact_brandId_idx" ON "Contact"("brandId");
