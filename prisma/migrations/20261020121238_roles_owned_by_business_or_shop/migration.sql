/*
  Warnings:

  - You are about to drop the column `denies` on the `AccessAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `grants` on the `AccessAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `isSystem` on the `AccessRole` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `AccessRole` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AccessRole_scope_providerId_key_key";

-- AlterTable
ALTER TABLE "AccessAssignment" DROP COLUMN "denies",
DROP COLUMN "grants";

-- AlterTable
ALTER TABLE "AccessRole" DROP COLUMN "isSystem",
DROP COLUMN "key",
ADD COLUMN     "businessId" TEXT;

-- CreateIndex
CREATE INDEX "AccessRole_businessId_idx" ON "AccessRole"("businessId");

-- CreateIndex
CREATE INDEX "AccessRole_providerId_idx" ON "AccessRole"("providerId");

-- AddForeignKey
ALTER TABLE "AccessRole" ADD CONSTRAINT "AccessRole_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRole" ADD CONSTRAINT "AccessRole_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
