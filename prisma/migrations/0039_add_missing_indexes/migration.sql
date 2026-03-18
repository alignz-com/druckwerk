-- Add missing indexes on foreign key columns
CREATE INDEX IF NOT EXISTS "User_brandId_idx" ON "User"("brandId");
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
