/*
  Warnings:

  - A unique constraint covering the columns `[publicProductId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicTaxId]` on the table `TaxRate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicWarehouseId]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "publicProductId" TEXT NOT NULL DEFAULT left(replace((gen_random_uuid())::text, '-', ''), 16);

-- AlterTable
ALTER TABLE "TaxRate" ADD COLUMN     "publicTaxId" TEXT NOT NULL DEFAULT left(replace((gen_random_uuid())::text, '-', ''), 16);

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "publicWarehouseId" TEXT NOT NULL DEFAULT left(replace((gen_random_uuid())::text, '-', ''), 16);

-- CreateIndex
CREATE UNIQUE INDEX "Product_publicProductId_key" ON "Product"("publicProductId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_publicTaxId_key" ON "TaxRate"("publicTaxId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_publicWarehouseId_key" ON "Warehouse"("publicWarehouseId");
