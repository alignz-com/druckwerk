-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "lieferscheinUrl" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "lieferscheinNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_lieferscheinNumber_key" ON "Delivery"("lieferscheinNumber");

-- CreateTable
CREATE TABLE "LieferscheinReferenceCounter" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LieferscheinReferenceCounter_pkey" PRIMARY KEY ("year")
);
