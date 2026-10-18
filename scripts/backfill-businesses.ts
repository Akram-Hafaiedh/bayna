// scripts/backfill-businesses.ts
// Gives every shop that has no business one (named like the shop) and makes its owner the business
// owner. Safe to run repeatedly. Run this after the migration that adds Business, and after
// `npm run access:sync` (which creates the business roles).
//
//   npm run db:backfill-businesses -- --dry     show what would change, change nothing
//   npm run db:backfill-businesses              apply
//
// For each shop without a business (soft-deleted shops included, so the column can be made required):
//   1. create a Business with the shop's name and link the shop to it
//   2. for a verified shop: the person who owns it (shop-level OWNER, or the applicant) becomes
//      business-level OWNER, and the shop-level OWNER assignment is removed (it is now inherited)
// Changes are written as the "Business backfill" actor, so they show up in ActivityLog with source SEED.
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { serializeActor, systemActor } from "../lib/audit/actor"

const dry = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const log: string[] = []

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Business backfill"))}, true)`

        const businessOwner = await tx.accessRole.findFirst({
            where: { scope: "BUSINESS", providerId: null, key: "OWNER" },
            select: { id: true },
        })
        const shopOwner = await tx.accessRole.findFirst({
            where: { scope: "SHOP", providerId: null, key: "OWNER" },
            select: { id: true },
        })
        if (!businessOwner) {
            throw new Error("The business roles do not exist yet. Run: npm run access:sync")
        }

        const shops = await tx.provider.findMany({
            where: { businessId: null },
            select: { id: true, userId: true, businessName: true, isVerified: true, deletedAt: true },
            orderBy: { createdAt: "asc" },
        })

        for (const shop of shops) {
            log.push(`business "${shop.businessName}" for shop ${shop.id}${shop.deletedAt ? " (deleted shop)" : ""}`)
            if (dry) continue

            const business = await tx.business.create({
                data: { name: shop.businessName, ...(shop.deletedAt ? { deletedAt: shop.deletedAt } : {}) },
                select: { id: true },
            })
            await tx.provider.update({ where: { id: shop.id }, data: { businessId: business.id } })

            if (!shop.isVerified || shop.deletedAt) continue

            // the people who own this shop today
            const owners = shopOwner
                ? await tx.accessAssignment.findMany({
                    where: { scope: "SHOP", providerId: shop.id, roleId: shopOwner.id },
                    select: { id: true, userId: true },
                })
                : []
            const ownerIds = new Set(owners.map((o) => o.userId))
            if (ownerIds.size === 0) ownerIds.add(shop.userId) // no assignment yet: the applicant owns it

            for (const userId of ownerIds) {
                await tx.accessAssignment.create({
                    data: { userId, roleId: businessOwner.id, scope: "BUSINESS", businessId: business.id, status: "ACTIVE" },
                })
                log.push(`  owner ${userId} becomes business owner`)
            }
            if (owners.length > 0) {
                await tx.accessAssignment.deleteMany({ where: { id: { in: owners.map((o) => o.id) } } })
                log.push(`  removed ${owners.length} shop-level owner assignment(s) (now inherited)`)
            }
        }
    })

    console.log(dry ? "Dry run, nothing was changed.\n" : "Backfill done.\n")
    console.log(log.length ? log.map((l) => "  " + l).join("\n") : "  Nothing to do, every shop already has a business.")
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
