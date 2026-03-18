-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('IDEA', 'PLANNED', 'IN_PROGRESS', 'DONE', 'PARKED');

-- CreateEnum
CREATE TYPE "FeaturePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('UI', 'BACKEND', 'INFRASTRUCTURE', 'BUG', 'IDEA');

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeatureStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "FeaturePriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "FeatureCategory" NOT NULL DEFAULT 'IDEA',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureComment" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feature_status_idx" ON "Feature"("status");

-- CreateIndex
CREATE INDEX "Feature_priority_idx" ON "Feature"("priority");

-- CreateIndex
CREATE INDEX "FeatureComment_featureId_idx" ON "FeatureComment"("featureId");

-- AddForeignKey
ALTER TABLE "FeatureComment" ADD CONSTRAINT "FeatureComment_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
