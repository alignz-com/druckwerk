-- Add template photo-slot flag
ALTER TABLE "Template"
ADD COLUMN IF NOT EXISTS "hasPhotoSlot" BOOLEAN NOT NULL DEFAULT FALSE;

-- Persist uploaded photo metadata on orders
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "photoOriginalUrl" TEXT,
ADD COLUMN IF NOT EXISTS "photoCroppedUrl" TEXT,
ADD COLUMN IF NOT EXISTS "photoMeta" JSONB;
