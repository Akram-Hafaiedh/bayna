-- Clearer names for the opaque ids used in addresses: publicShopId, publicBusinessId, and the new publicUserId.
-- The shop and business columns are renamed (not dropped and re-added), so every existing address keeps working.
ALTER TABLE "Provider" RENAME COLUMN "publicId" TO "publicShopId";
ALTER INDEX "Provider_publicId_key" RENAME TO "Provider_publicShopId_key";

ALTER TABLE "Business" RENAME COLUMN "publicId" TO "publicBusinessId";
ALTER INDEX "Business_publicId_key" RENAME TO "Business_publicBusinessId_key";

-- Existing users get a random public id; new ones get theirs from Prisma (cuid), so the database default is dropped.
ALTER TABLE "User" ADD COLUMN "publicUserId" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "User" ALTER COLUMN "publicUserId" DROP DEFAULT;
CREATE UNIQUE INDEX "User_publicUserId_key" ON "User"("publicUserId");
