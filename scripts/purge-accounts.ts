// scripts/purge-accounts.ts
// Anonymises the accounts whose 14-day deletion grace period is over (see lib/account-erasure.ts).
// Safe to run as often as you like. Put it on a daily schedule once there is somewhere to run one.
//
//   npm run db:purge-accounts
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { purgeDueAccounts } from "../lib/account-erasure"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const { purged, skipped } = await purgeDueAccounts(prisma)
    console.log(`${purged.length} account(s) anonymised.`)
    for (const s of skipped) console.log(`  left as they are: ${s.id} (${s.reason})`)
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
