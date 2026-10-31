-- Inventory (R3): hand-written SQL for Warehouse, StockLevel and StockMovement.
-- Prisma generates the tables; this adds what it cannot express. For a database that already has the
-- baseline, paste this file at the end of the generated migration (`npx prisma migrate dev --create-only
-- --name inventory`, then append this). The baseline script (npm run db:baseline) appends every file in
-- prisma/sql/ after prisma/audit.sql, in name order.

-- Audit columns on every row. Warehouse changes are logged; stock levels and movements are only stamped,
-- because the ledger (StockMovement) already is the history of stock.
SELECT audit_attach('Warehouse');
SELECT audit_attach('StockLevel', '', '', false);
SELECT audit_attach('StockMovement', '', '', false);

-- One live default warehouse per shop.
CREATE UNIQUE INDEX "Warehouse_one_default_per_shop" ON "Warehouse" ("shopId") WHERE "isDefault" AND "archivedAt" IS NULL;

-- Stock can never go below zero, whatever the application does.
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_quantity_not_negative" CHECK ("quantity" >= 0);
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_reorderPoint_not_negative" CHECK ("reorderPoint" IS NULL OR "reorderPoint" >= 0);

-- A movement changes stock (never zero), and the balance it leaves is never negative.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_not_zero" CHECK ("quantity" <> 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_balance_not_negative" CHECK ("balanceAfter" >= 0);

-- The ledger is append-only: rows are never edited or deleted (like "ActivityLog"). A retention or
-- erasure job can lift the guard for one transaction with  SELECT set_config('app.audit_maintenance', 'on', true);
CREATE OR REPLACE FUNCTION stock_movement_guard() RETURNS trigger
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
  RAISE EXCEPTION 'StockMovement is append-only (% blocked)', TG_OP USING ERRCODE = '55000';
END
$fn$;

CREATE TRIGGER stock_movement_guard
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION stock_movement_guard();
