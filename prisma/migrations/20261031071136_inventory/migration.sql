-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIVED', 'SOLD', 'ADJUSTED', 'RETURNED', 'COUNTED', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "governorate" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationSource" "LocationSource",
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "transferId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_shopId_idx" ON "Warehouse"("shopId");

-- CreateIndex
CREATE INDEX "StockLevel_warehouseId_idx" ON "StockLevel"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_productId_warehouseId_key" ON "StockLevel"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_createdAt_idx" ON "StockMovement"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_shopId_createdAt_idx" ON "StockMovement"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_transferId_idx" ON "StockMovement"("transferId");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Inventory (R3): hand-written SQL for Warehouse, StockLevel and StockMovement.
-- Prisma generates the tables; this adds what it cannot express. For a database that already has the
-- baseline, paste this file at the end of the generated migration (`npx prisma migrate dev --create-only
-- --name inventory`, then append this). The baseline script (npm run db:baseline) appends every file in
-- prisma/sql/ after prisma/audit.sql, in name order.

-- Audit columns on every row. Warehouse changes are logged; stock levels and movements are only stamped,
-- because the ledger (StockMovement) already is the history of stock.
SELECT audit_attach('Warehouse');
SELECT audit_attach('StockLevel', '', '', false);
SELECT audit_attach('StockMovement', '', '', false);

-- One live default warehouse per shop.
CREATE UNIQUE INDEX "Warehouse_one_default_per_shop" ON "Warehouse" ("shopId") WHERE "isDefault" AND "archivedAt" IS NULL;

-- Stock can never go below zero, whatever the application does.
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_quantity_not_negative" CHECK ("quantity" >= 0);
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_reorderPoint_not_negative" CHECK ("reorderPoint" IS NULL OR "reorderPoint" >= 0);

-- A movement changes stock (never zero), and the balance it leaves is never negative.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_not_zero" CHECK ("quantity" <> 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_balance_not_negative" CHECK ("balanceAfter" >= 0);

-- The ledger is append-only: rows are never edited or deleted (like "ActivityLog"). A retention or
-- erasure job can lift the guard for one transaction with  SELECT set_config('app.audit_maintenance', 'on', true);
CREATE OR REPLACE FUNCTION stock_movement_guard() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF coalesce(current_setting('app.audit_maintenance', true), '') = 'on' THEN
    IF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'StockMovement is append-only (% blocked)', TG_OP USING ERRCODE = '55000';
END
$fn$;

CREATE TRIGGER stock_movement_guard
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION stock_movement_guard();
