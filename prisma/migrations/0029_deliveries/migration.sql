-- Add new order status for deliveries
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DELIVERY';

-- Delivery tables
CREATE TABLE IF NOT EXISTS "Delivery" (
  "id" TEXT PRIMARY KEY,
  "number" TEXT NOT NULL UNIQUE,
  "note" TEXT,
  "deliveryNoteUrl" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "Delivery_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DeliveryItem" (
  "id" TEXT PRIMARY KEY,
  "deliveryId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL UNIQUE,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

-- Sequence for delivery numbers
CREATE TABLE IF NOT EXISTS "DeliveryReferenceCounter" (
  "year" INTEGER PRIMARY KEY,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
