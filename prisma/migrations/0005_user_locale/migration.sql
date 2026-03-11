ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

UPDATE "User"
SET "locale" = COALESCE(NULLIF("locale", ''), 'en');
