/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Business` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `Provider` will be added. If there are existing duplicate values, this will fail.
  - The required column `publicId` was added to the `Business` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `publicId` was added to the `Provider` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `businessId` on table `Provider` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "publicId" TEXT NOT NULL,
ALTER COLUMN "businessId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Business_publicId_key" ON "Business"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_publicId_key" ON "Provider"("publicId");
