-- Behaviour test for the audit triggers (migration *_audit_triggers).
--
-- Run against a database with all migrations applied:
--   npm run test:audit-db        (or: psql -U postgres -d bayna -v ON_ERROR_STOP=1 -f prisma/tests/audit-foundation.sql)
--
-- Everything runs in one transaction that is rolled back, so no data is left behind.
-- Prints one PASS line per check and stops at the first FAIL.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.expect(ok boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', msg;
  END IF;
  RAISE NOTICE 'PASS: %', msg;
END
$$;

CREATE FUNCTION pg_temp.logs(etype text, eid text, act text DEFAULT NULL) RETURNS int
LANGUAGE sql AS $$
  SELECT count(*)::int FROM "ActivityLog"
   WHERE "entityType" = etype AND "entityId" = eid AND (act IS NULL OR "action" = act)
$$;

-- ---------------------------------------------------------------------------
-- 1. Insert as actor A: stamps the columns and writes a log row with the context
-- ---------------------------------------------------------------------------
SELECT set_config('app.audit', '{"actorId":"audit_test_admin","actorName":"Test Admin","actorRole":"ADMIN","source":"WEB","requestId":"req-1","ip":"203.0.113.9","userAgent":"UA"}', true);

INSERT INTO "User" (id, email, name, password, role, "updatedAt")
VALUES ('audit_test_owner', 'owner@audit.test', 'Owner', 'secret-hash', 'PROVIDER', now());
INSERT INTO "Category" (id, name, slug, "updatedAt") VALUES ('audit_test_cat', 'Audit Cat', 'audit-cat', now());
INSERT INTO "Provider" (id, "userId", "businessName", city, "updatedAt")
VALUES ('audit_test_prov', 'audit_test_owner', 'Audit Shop', 'Tunis', now());
INSERT INTO "Product" (id, "providerId", name, price, images, "updatedAt")
VALUES ('audit_test_p1', 'audit_test_prov', 'P1', 12.500, '{}', now()),
       ('audit_test_p2', 'audit_test_prov', 'P2', 5.000, '{}', now());

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM "Product" WHERE id = 'audit_test_p1';
  PERFORM pg_temp.expect(r."createdById" = 'audit_test_admin' AND r."updatedById" = 'audit_test_admin',
    'insert stamps createdById and updatedById');

  SELECT * INTO r FROM "ActivityLog" WHERE "entityType" = 'Product' AND "entityId" = 'audit_test_p1' AND action = 'CREATE';
  PERFORM pg_temp.expect(r."actorId" = 'audit_test_admin' AND r."actorName" = 'Test Admin' AND r."actorRole" = 'ADMIN'
    AND r.source = 'WEB' AND r."requestId" = 'req-1' AND r.ip = '203.0.113.9' AND r."userAgent" = 'UA',
    'create log row carries actor, snapshot, source and request metadata');
  PERFORM pg_temp.expect(r."providerId" = 'audit_test_prov', 'product log row carries providerId');

  SELECT * INTO r FROM "ActivityLog" WHERE "entityType" = 'Provider' AND "entityId" = 'audit_test_prov';
  PERFORM pg_temp.expect(r."providerId" = 'audit_test_prov', 'provider log row uses its own id as providerId');
END $$;

-- ---------------------------------------------------------------------------
-- 2. Update as actor B: updatedById changes, createdBy/createdAt cannot be forged, diff is exact
-- ---------------------------------------------------------------------------
SELECT set_config('app.audit', '{"actorId":"audit_test_staff","actorName":"Staff","actorRole":"shop:MANAGER","source":"WEB"}', true);

UPDATE "Product" SET price = 15.000, "createdAt" = '2000-01-01', "createdById" = 'forged' WHERE id = 'audit_test_p1';

DO $$
DECLARE r record; l record;
BEGIN
  SELECT * INTO r FROM "Product" WHERE id = 'audit_test_p1';
  PERFORM pg_temp.expect(r."updatedById" = 'audit_test_staff', 'update stamps updatedById with the new actor');
  PERFORM pg_temp.expect(r."createdById" = 'audit_test_admin', 'createdById cannot be changed');
  PERFORM pg_temp.expect(r."createdAt" > '2020-01-01', 'createdAt cannot be changed');

  SELECT * INTO l FROM "ActivityLog" WHERE "entityType" = 'Product' AND "entityId" = 'audit_test_p1' AND action = 'UPDATE';
  PERFORM pg_temp.expect(jsonb_array_length(l.changes) = 1 AND l.changes -> 0 ->> 'field' = 'price'
    AND (l.changes -> 0 ->> 'from')::numeric = 12.5 AND (l.changes -> 0 ->> 'to')::numeric = 15,
    'update log holds exactly the changed field with before and after values');
  PERFORM pg_temp.expect(l."actorId" = 'audit_test_staff' AND l."actorRole" = 'shop:MANAGER', 'update log carries the acting user');
END $$;

-- ---------------------------------------------------------------------------
-- 3. No-op update writes no log row; update without an actor is still recorded
-- ---------------------------------------------------------------------------
DO $$
DECLARE n0 int := pg_temp.logs('Product', 'audit_test_p1', 'UPDATE');
BEGIN
  UPDATE "Product" SET price = price WHERE id = 'audit_test_p1';
  PERFORM pg_temp.expect(pg_temp.logs('Product', 'audit_test_p1', 'UPDATE') = n0, 'no-op update writes no log row');
END $$;

SELECT set_config('app.audit', '', true);
UPDATE "Product" SET stock = 7 WHERE id = 'audit_test_p1';

DO $$
DECLARE r record;
BEGIN
  SELECT "updatedById" INTO r FROM "Product" WHERE id = 'audit_test_p1';
  PERFORM pg_temp.expect(r."updatedById" IS NULL, 'update without an actor clears updatedById (never keeps a stale person)');
  SELECT * INTO r FROM "ActivityLog"
   WHERE "entityId" = 'audit_test_p1' AND action = 'UPDATE' AND changes @> '[{"field":"stock"}]'::jsonb;
  PERFORM pg_temp.expect(r."actorId" IS NULL AND r.source = 'SYSTEM', 'update without an actor is logged with source SYSTEM');
END $$;

-- ---------------------------------------------------------------------------
-- 4. Bulk update (updateMany) logs one row per changed row
-- ---------------------------------------------------------------------------
SELECT set_config('app.audit', '{"actorId":"audit_test_admin","actorName":"Test Admin","actorRole":"ADMIN","source":"WEB"}', true);

DO $$
BEGIN
  UPDATE "Product" SET "isActive" = false WHERE "providerId" = 'audit_test_prov';
  PERFORM pg_temp.expect(
    (SELECT count(*) FROM "ActivityLog" WHERE "entityType" = 'Product' AND "entityId" IN ('audit_test_p1', 'audit_test_p2')
        AND action = 'UPDATE' AND changes @> '[{"field":"isActive"}]'::jsonb) = 2,
    'bulk update logs one row per product');
END $$;

-- ---------------------------------------------------------------------------
-- 5. Secrets are redacted everywhere
-- ---------------------------------------------------------------------------
UPDATE "User" SET password = 'new-secret-hash' WHERE id = 'audit_test_owner';
INSERT INTO "PasswordResetToken" (id, email, token, expires, "updatedAt")
VALUES ('audit_test_prt', 'owner@audit.test', 'reset-secret-token', now() + interval '1 hour', now());

DO $$
DECLARE l record;
BEGIN
  SELECT * INTO l FROM "ActivityLog"
   WHERE "entityType" = 'User' AND "entityId" = 'audit_test_owner' AND changes @> '[{"field":"password"}]'::jsonb AND action = 'UPDATE';
  PERFORM pg_temp.expect(l.changes @> '[{"field":"password","from":"[redacted]","to":"[redacted]"}]'::jsonb,
    'password change is logged as redacted before and after');
  PERFORM pg_temp.expect(
    (SELECT count(*) FROM "ActivityLog" WHERE changes::text LIKE '%secret-hash%' OR changes::text LIKE '%reset-secret-token%') = 0,
    'no secret value appears anywhere in ActivityLog');
  PERFORM pg_temp.expect(pg_temp.logs('PasswordResetToken', 'audit_test_prt', 'CREATE') = 1,
    'password reset request is logged (token redacted)');
END $$;

-- ---------------------------------------------------------------------------
-- 6. Ignored columns do not create noise; real changes on the same table do
-- ---------------------------------------------------------------------------
INSERT INTO "LoginSession" (id, "userId") VALUES ('audit_test_ls', 'audit_test_owner');

DO $$
DECLARE u0 int := pg_temp.logs('User', 'audit_test_owner', 'UPDATE'); s0 int;
BEGIN
  UPDATE "User" SET "lastLoginAt" = now() WHERE id = 'audit_test_owner';
  PERFORM pg_temp.expect(pg_temp.logs('User', 'audit_test_owner', 'UPDATE') = u0, 'lastLoginAt alone writes no log row');

  PERFORM pg_temp.expect(pg_temp.logs('LoginSession', 'audit_test_ls', 'CREATE') = 1, 'a login (LoginSession insert) is logged');
  s0 := pg_temp.logs('LoginSession', 'audit_test_ls', 'UPDATE');
  UPDATE "LoginSession" SET "lastActiveAt" = now() + interval '1 minute' WHERE id = 'audit_test_ls';
  PERFORM pg_temp.expect(pg_temp.logs('LoginSession', 'audit_test_ls', 'UPDATE') = s0, 'lastActiveAt alone writes no log row');
  UPDATE "LoginSession" SET "revokedAt" = now() WHERE id = 'audit_test_ls';
  PERFORM pg_temp.expect(pg_temp.logs('LoginSession', 'audit_test_ls', 'UPDATE') = s0 + 1, 'a revoked session is logged');
END $$;

-- ---------------------------------------------------------------------------
-- 7. Soft delete and restore get their own actions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  UPDATE "Product" SET "deletedAt" = now(), "deletedById" = 'audit_test_admin' WHERE id = 'audit_test_p2';
  PERFORM pg_temp.expect(pg_temp.logs('Product', 'audit_test_p2', 'SOFT_DELETE') = 1, 'setting deletedAt logs SOFT_DELETE');
  UPDATE "Product" SET "deletedAt" = NULL, "deletedById" = NULL WHERE id = 'audit_test_p2';
  PERFORM pg_temp.expect(pg_temp.logs('Product', 'audit_test_p2', 'RESTORE') = 1, 'clearing deletedAt logs RESTORE');
END $$;

-- ---------------------------------------------------------------------------
-- 8. Session and VerificationToken are stamped but not logged (they hold secrets)
-- ---------------------------------------------------------------------------
INSERT INTO "Session" (id, "sessionToken", "userId", expires)
VALUES ('audit_test_se', 'audit_test_tok_session', 'audit_test_owner', now() + interval '1 day');
INSERT INTO "VerificationToken" (identifier, token, expires)
VALUES ('owner@audit.test', 'audit_test_tok_verify', now() + interval '1 day');

DO $$
BEGIN
  PERFORM pg_temp.expect((SELECT "createdById" FROM "Session" WHERE id = 'audit_test_se') = 'audit_test_admin',
    'Session is stamped');
  PERFORM pg_temp.expect((SELECT "createdById" FROM "VerificationToken" WHERE token = 'audit_test_tok_verify') = 'audit_test_admin',
    'VerificationToken (no id column) is stamped');
  PERFORM pg_temp.expect((SELECT count(*) FROM "ActivityLog" WHERE "entityType" IN ('Session', 'VerificationToken')) = 0,
    'Session and VerificationToken write no log rows');
END $$;

-- ---------------------------------------------------------------------------
-- 9. A malformed context never blocks a write; timestamps are UTC in any session time zone
-- ---------------------------------------------------------------------------
SELECT set_config('app.audit', 'not json', true);
SET LOCAL TIME ZONE 'Africa/Tunis';
INSERT INTO "Category" (id, name, slug, "updatedAt") VALUES ('audit_test_cat2', 'Audit Cat 2', 'audit-cat-2', now());

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM "ActivityLog" WHERE "entityType" = 'Category' AND "entityId" = 'audit_test_cat2';
  PERFORM pg_temp.expect(r.id IS NOT NULL AND r."actorId" IS NULL AND r.source = 'SYSTEM',
    'a malformed audit context is ignored and the write still succeeds');
  PERFORM pg_temp.expect(
    abs(extract(epoch FROM ((SELECT "updatedAt" FROM "Category" WHERE id = 'audit_test_cat2') - (now() AT TIME ZONE 'UTC')))) < 5
    AND abs(extract(epoch FROM (r."createdAt" - (now() AT TIME ZONE 'UTC')))) < 5,
    'updatedAt and the log timestamp are UTC even when the session time zone is not');
END $$;
RESET TIME ZONE;

-- ---------------------------------------------------------------------------
-- 10. Deleting a shop: cascaded product deletions are logged with the shop id
-- ---------------------------------------------------------------------------
SELECT set_config('app.audit', '{"actorId":"audit_test_admin","actorName":"Test Admin","actorRole":"ADMIN","source":"WEB"}', true);
DELETE FROM "Provider" WHERE id = 'audit_test_prov';

DO $$
DECLARE r record;
BEGIN
  PERFORM pg_temp.expect(pg_temp.logs('Provider', 'audit_test_prov', 'DELETE') = 1, 'deleting a provider is logged');
  SELECT * INTO r FROM "ActivityLog" WHERE "entityType" = 'Product' AND "entityId" = 'audit_test_p1' AND action = 'DELETE';
  PERFORM pg_temp.expect(r.id IS NOT NULL AND r."providerId" = 'audit_test_prov' AND r."actorId" = 'audit_test_admin',
    'cascaded product deletions are logged with the shop id and the actor');
END $$;

-- ---------------------------------------------------------------------------
-- 11. ActivityLog is append-only (unless a maintenance job lifts the guard)
-- ---------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  BEGIN
    UPDATE "ActivityLog" SET note = 'tamper' WHERE "entityId" = 'audit_test_p1';
    PERFORM pg_temp.expect(false, 'ActivityLog UPDATE should be blocked');
  EXCEPTION WHEN sqlstate '55000' THEN
    PERFORM pg_temp.expect(true, 'ActivityLog UPDATE is blocked');
  END;
  BEGIN
    DELETE FROM "ActivityLog" WHERE "entityId" = 'audit_test_p1';
    PERFORM pg_temp.expect(false, 'ActivityLog DELETE should be blocked');
  EXCEPTION WHEN sqlstate '55000' THEN
    PERFORM pg_temp.expect(true, 'ActivityLog DELETE is blocked');
  END;
  BEGIN
    TRUNCATE "ActivityLog";
    PERFORM pg_temp.expect(false, 'ActivityLog TRUNCATE should be blocked');
  EXCEPTION WHEN sqlstate '55000' THEN
    PERFORM pg_temp.expect(true, 'ActivityLog TRUNCATE is blocked');
  END;

  PERFORM set_config('app.audit_maintenance', 'on', true);
  UPDATE "ActivityLog" SET "actorName" = 'anonymised' WHERE "entityType" = 'Product' AND "entityId" = 'audit_test_p1' AND action = 'DELETE';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect(n = 1, 'the maintenance flag allows an anonymisation update');
  PERFORM set_config('app.audit_maintenance', '', true);
END $$;

-- ---------------------------------------------------------------------------
-- 12. Coverage: no table can be added without the audit columns and triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(t.table_name || '.' || c.col, ', ') INTO missing
    FROM information_schema.tables t
   CROSS JOIN (VALUES ('createdAt'), ('updatedAt'), ('createdById'), ('updatedById')) AS c(col)
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     AND t.table_name NOT IN ('_prisma_migrations', 'ActivityLog')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns k
                      WHERE k.table_schema = 'public' AND k.table_name = t.table_name AND k.column_name = c.col);
  PERFORM pg_temp.expect(missing IS NULL, 'every table has the four audit columns' || coalesce(' (missing: ' || missing || ')', ''));

  SELECT string_agg(c.relname, ', ') INTO missing
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT IN ('_prisma_migrations', 'ActivityLog')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'audit_stamp' AND NOT t.tgisinternal);
  PERFORM pg_temp.expect(missing IS NULL, 'every table has the audit_stamp trigger' || coalesce(' (missing: ' || missing || ')', ''));

  SELECT string_agg(c.relname, ', ') INTO missing
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND c.relname NOT IN ('_prisma_migrations', 'ActivityLog', 'Session', 'VerificationToken', 'Notification')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'audit_log' AND NOT t.tgisinternal);
  PERFORM pg_temp.expect(missing IS NULL, 'every table (except Session, VerificationToken, Notification) has the audit_log trigger' || coalesce(' (missing: ' || missing || ')', ''));
END $$;

ROLLBACK;
