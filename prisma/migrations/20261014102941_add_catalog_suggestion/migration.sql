-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CatalogSuggestion" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "brand" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "categoryId" TEXT NOT NULL,
    "note" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "catalogItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSuggestion_productId_key" ON "CatalogSuggestion"("productId");

-- CreateIndex
CREATE INDEX "CatalogSuggestion_status_createdAt_idx" ON "CatalogSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogSuggestion_providerId_idx" ON "CatalogSuggestion"("providerId");

-- AddForeignKey
ALTER TABLE "CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
