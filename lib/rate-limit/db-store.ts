// lib/rate-limit/db-store.ts
// The shared layer on the Postgres we already run, so no new service is needed. One atomic upsert per try:
// a new key starts at 1; an existing key whose window ended starts again at 1; otherwise it adds 1.
// If traffic ever outgrows this, swap in a Redis-backed SharedStore with the same three methods.
//
// Time zones: Prisma's DateTime is `timestamp without time zone` and holds UTC. now() is a timestamptz, and
// converting it to a plain timestamp uses the SESSION time zone, which on a local Postgres is often not UTC.
// So every moment here is `now() AT TIME ZONE 'UTC'`, and the caller gets "ms left" computed in the database
// rather than a date to interpret.
import { prisma } from "@/lib/prisma"
import type { HitResult, SharedStore } from "./limiter"


type Row = { count: number; retryMs: number }
const toResult = (row: Row): HitResult => ({ count: Number(row.count), retryMs: Math.max(0, Number(row.retryMs)) })

export const dbStore: SharedStore = {
    async hit(key, windowMs) {
        const rows = await prisma.$queryRaw<Row[]>`
            INSERT INTO "RateLimit" ("key", "count", "resetAt", "createdAt", "updatedAt")
            VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + (${windowMs}::int * interval '1 millisecond'),
                    (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
            ON CONFLICT ("key") DO UPDATE SET
                "count" = CASE WHEN "RateLimit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimit"."count" + 1 END,
                "resetAt" = CASE WHEN "RateLimit"."resetAt" <= (now() AT TIME ZONE 'UTC')
                                 THEN (now() AT TIME ZONE 'UTC') + (${windowMs}::int * interval '1 millisecond')
                                 ELSE "RateLimit"."resetAt" END,
                "updatedAt" = (now() AT TIME ZONE 'UTC')
            RETURNING "count", ROUND(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))) * 1000)::int AS "retryMs"`
        const row = rows[0]
        if (!row) throw new Error("rate limit upsert returned no row")
        // Now and then, drop windows that ended long ago so the table stays small
        if (Math.random() < 0.01) {
            prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < (now() AT TIME ZONE 'UTC') - interval '1 day'`.catch(() => { })
        }
        return toResult(row)
    },
    async peek(key) {
        const rows = await prisma.$queryRaw<Row[]>`
            SELECT "count", ROUND(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))) * 1000)::int AS "retryMs"
              FROM "RateLimit"
             WHERE "key" = ${key} AND "resetAt" > (now() AT TIME ZONE 'UTC')`
        return rows[0] ? toResult(rows[0]) : null
    },
    async clear(key) {
        await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${key}`
    },
}
