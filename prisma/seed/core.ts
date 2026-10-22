// prisma/seed/core.ts
// What every seeder shares: the Seeder shape and a few helpers (no database connection here, so the
// seeder files can be imported by unit tests; the connection is opened in index.ts).
// A seeder = one file in seeders/ that owns ONE kind of data and holds its values at the top of the file.
// Seeders are idempotent (safe to run again) and say what they need first (`needs`).
import type { PrismaClient } from "../../app/generated/prisma/client"

/**
 * reference  real data every environment needs (platform roles, categories, catalogue)
 * demo       fictional companies, shops, owners and offers
 * test       accounts with a known password, for trying roles, invites and permissions
 * Only `reference` runs when NODE_ENV=production (and the others only with SEED_ALLOW_DEMO=1).
 */
export type SeedKind = "reference" | "demo" | "test"

export type SeedContext = {
    prisma: PrismaClient
    /** Print one indented line under the seeder's name */
    log: (message: string) => void
}

export type Seeder = {
    /** Used on the command line: npm run seed categories,catalogue */
    name: string
    kind: SeedKind
    description: string
    /** Names of the seeders whose data this one reads. Informational and checked by --list. */
    needs: string[]
    /** Returns a one-line summary */
    run: (ctx: SeedContext) => Promise<string>
}

/** A problem the person running the seed can fix (a missing earlier step). Printed without a stack. */
export class SeedError extends Error { }

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}

/** The password every seeded demo and test account uses (override with SEED_DEMO_PASSWORD). */
export const SEED_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo1234"
