/*
  Warnings:

  - A unique constraint covering the columns `[providerId,catalogItemId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Product_providerId_catalogItemId_key" ON "Product"("providerId", "catalogItemId");
