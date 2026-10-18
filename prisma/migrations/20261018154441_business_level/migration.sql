-- AlterEnum
ALTER TYPE "AccessScope" ADD VALUE 'BUSINESS';

-- AlterTable
ALTER TABLE "AccessAssignment" ADD COLUMN     "businessId" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "businessId" TEXT;

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "registryNumber" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "billingAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessAssignment_businessId_idx" ON "AccessAssignment"("businessId");

-- CreateIndex
CREATE INDEX "Provider_businessId_idx" ON "Provider"("businessId");

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT audit_attach('Business');