-- Add optional url column for storing the user's website inferred from profile data.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "url" TEXT;
