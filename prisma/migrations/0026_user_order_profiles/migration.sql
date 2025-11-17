-- Create table to persist per-user order form preferences per brand
CREATE TABLE "UserOrderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "url" TEXT,
    "linkedin" TEXT,
    "addressId" TEXT,
    "addressLabel" TEXT,
    "companyName" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "addressBlock" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOrderProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOrderProfile_userId_brandId_key" ON "UserOrderProfile"("userId", "brandId");

ALTER TABLE "UserOrderProfile"
ADD CONSTRAINT "UserOrderProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserOrderProfile"
ADD CONSTRAINT "UserOrderProfile_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
