-- RateLimit: stamp the audit columns, write no log rows
--   The rate limiter writes a row on every sign-in attempt; those are throwaway counters, not history, so they
--   are not logged (like Notification). They still get the audit trigger that stamps the columns, which is what
--   `npm run test:audit-db` checks for every table.
SELECT audit_attach('RateLimit', '', '', false);
