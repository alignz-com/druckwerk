-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'Thurnher Druckerei GmbH',
    "logoUrl" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "confirmationFontFamily" TEXT,
    "letterheadUrl" TEXT,
    "letterheadStoragePath" TEXT,
    "safeTopMm" DOUBLE PRECISION,
    "safeBottomMm" DOUBLE PRECISION,
    "safeLeftMm" DOUBLE PRECISION,
    "safeRightMm" DOUBLE PRECISION,
    "addressWindowXMm" DOUBLE PRECISION,
    "addressWindowYMm" DOUBLE PRECISION,
    "addressWindowWidthMm" DOUBLE PRECISION,
    "addressWindowHeightMm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
