ALTER TABLE "Delivery"
ADD COLUMN IF NOT EXISTS "brandId" TEXT,
ADD COLUMN IF NOT EXISTS "shippingName" TEXT,
ADD COLUMN IF NOT EXISTS "shippingCompany" TEXT,
ADD COLUMN IF NOT EXISTS "shippingStreet" TEXT,
ADD COLUMN IF NOT EXISTS "shippingPostalCode" TEXT,
ADD COLUMN IF NOT EXISTS "shippingCity" TEXT,
ADD COLUMN IF NOT EXISTS "shippingCountryCode" TEXT,
ADD COLUMN IF NOT EXISTS "shippingAddressExtra" TEXT;

UPDATE "Delivery" d
SET "brandId" = (
  SELECT o."brandId" FROM "DeliveryItem" di JOIN "Order" o ON di."orderId" = o.id WHERE di."deliveryId" = d.id LIMIT 1
)
WHERE "brandId" IS NULL;

ALTER TABLE "Delivery" ALTER COLUMN "brandId" SET NOT NULL;

ALTER TABLE "Delivery"
ADD CONSTRAINT "Delivery_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
