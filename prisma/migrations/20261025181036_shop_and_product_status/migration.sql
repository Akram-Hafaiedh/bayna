
-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('DRAFT','PENDING','ACTIVE','SUSPENDED','CLOSED');
-- AlterTable
ALTER TABLE "Provider" ADD COLUMN "status" "ShopStatus" NOT NULL DEFAULT 'PENDING';
-- Update
UPDATE "Provider" SET "status"='ACTIVE' WHERE "isVerified"=true;
-- AlterTable
ALTER TABLE "Provider" DROP COLUMN "isVerified";
-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT','ACTIVE','HIDDEN','BLOCKED');
-- AlterTable
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';
-- Update
UPDATE "Product" SET "status"='HIDDEN' WHERE "isActive"=false;
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "isActive";