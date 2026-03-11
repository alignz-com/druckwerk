ALTER TABLE "UserOrderProfile" ADD COLUMN IF NOT EXISTS "seniority" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "requesterSeniority" TEXT;
