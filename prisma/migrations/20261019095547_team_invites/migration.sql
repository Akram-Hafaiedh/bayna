-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "AccessInvite" (
    "id" TEXT NOT NULL,
    "scope" "AccessScope" NOT NULL,
    "providerId" TEXT,
    "businessId" TEXT,
    "roleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AccessInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessInvite_tokenHash_key" ON "AccessInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessInvite_providerId_status_idx" ON "AccessInvite"("providerId", "status");

-- CreateIndex
CREATE INDEX "AccessInvite_businessId_status_idx" ON "AccessInvite"("businessId", "status");

-- CreateIndex
CREATE INDEX "AccessInvite_email_idx" ON "AccessInvite"("email");

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit: log changes to invites, never store the token hash in the log
SELECT audit_attach('AccessInvite', '', 'tokenHash');