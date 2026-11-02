-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(12,3) NOT NULL,
    "priceTtc" DECIMAL(12,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceHistory_productId_createdAt_idx" ON "PriceHistory"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_shopId_createdAt_idx" ON "PriceHistory"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Price history (R3 3B): hand-written SQL for PriceHistory.
-- Prisma generates the table; this adds what it cannot express. For a database that already has the
-- taxes migration, paste this file at the end of the generated migration (`npx prisma migrate dev
-- --create-only --name price_history`, then append this). The baseline script (npm run db:baseline)
-- appends every file in prisma/sql/ after prisma/audit.sql, in name order.

-- Audit columns on every row. Only stamped, not logged: the table already is the history of prices.
SELECT audit_attach('PriceHistory', '', '', false);

ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_reason_known" CHECK ("reason" IN ('INITIAL', 'PRICE', 'TAX'));
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_price_not_negative" CHECK ("price" >= 0 AND "priceTtc" >= 0);

-- Append-only: rows are never edited or deleted (like "StockMovement"). A retention or erasure job can lift
-- the guard for one transaction with  SELECT set_config('app.audit_maintenance', 'on', true);
CREATE OR REPLACE FUNCTION price_history_guard() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF coalesce(current_setting('app.audit_maintenance', true), '') = 'on' THEN
    IF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'PriceHistory is append-only (% blocked)', TG_OP USING ERRCODE = '55000';
END
$fn$;

CREATE TRIGGER price_history_guard
BEFORE UPDATE OR DELETE ON "PriceHistory"
FOR EACH ROW EXECUTE FUNCTION price_history_guard();

-- Every product that exists starts with a history: its current price, dated by when the price was last set.
-- Idempotent: a product that already has a row is skipped.
INSERT INTO "PriceHistory" ("shopId", "productId", "price", "priceTtc", "reason", "createdAt")
SELECT p."shopId", p."id", p."price", p."priceTtc", 'INITIAL', coalesce(p."priceUpdatedAt", p."createdAt")
FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "PriceHistory" h WHERE h."productId" = p."id");
