// scripts/sync-access.ts
// Sets up roles and owners for the data that exists. Safe to run repeatedly. The work itself is in
// lib/access/sync.ts (the `access` seeder in prisma/seed uses the same code).
//
//   npm run access:sync              apply
//   npm run access:sync -- --dry     show what would change, change nothing
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { syncAccess } from "../lib/access/sync"

const dry = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const log = await syncAccess(prisma, { dry })
    console.log(dry ? "Dry run, nothing was changed.\n" : "Access sync done.\n")
    console.log(log.length ? log.map((l) => "  " + l).join("\n") : "  Nothing to do, already in sync.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
