-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('LOOKUP', 'PIN', 'GEOCODED', 'IMPORTED');

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "locationSource" "LocationSource",
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp" TEXT;
