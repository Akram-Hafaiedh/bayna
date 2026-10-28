-- Audit trail for the tables added since the plans work, and the first plan prices
--   Plan, Subscription and ContactMessage were created by `prisma migrate dev`, which does not know about the
--   audit triggers. This stamps their audit columns and logs every change to them (the message text is left out
--   of the log: it is personal and already in the table).
--   The prices fill only plans that have no price yet, so a price someone set is never replaced.
--   Pro 40 TND / month or 400 TND / year, Business 100 TND / month or 1000 TND / year (two months free).
--   Change them later with `npm run db:set-price`.

UPDATE "Plan" SET "priceMonthly" = 40, "priceYearly" = 400 WHERE "key" = 'PRO' AND "priceMonthly" IS NULL AND "priceYearly" IS NULL;
UPDATE "Plan" SET "priceMonthly" = 100, "priceYearly" = 1000 WHERE "key" = 'BUSINESS' AND "priceMonthly" IS NULL AND "priceYearly" IS NULL;

SELECT audit_attach('Plan');
SELECT audit_attach('Subscription');
SELECT audit_attach('ContactMessage', '', 'message');
