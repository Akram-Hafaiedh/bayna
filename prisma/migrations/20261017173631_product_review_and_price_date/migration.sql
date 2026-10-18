-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "needsPriceReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceReviewReason" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3);
