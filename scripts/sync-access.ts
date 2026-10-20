// scripts/sync-access.ts
// Sets up roles and owners for the data that exists. Safe to run repeatedly.
//
//   npm run access:sync              apply
//   npm run access:sync -- --dry     show what would change, change nothing
//
// Roles are ordinary rows owned by the platform, a business or a shop (see lib/access/role-seed.ts).
// This script only fills in what is missing, it never rewrites a role someone has edited.
//   1. Platform roles (Super admin, Admin, Support agent ...) are created if there are none.
//   2. Every user with User.role = ADMIN and no platform assignment becomes a platform "everything" role.
//   3. Every shop without a business gets one (named like the shop).
//   4. Every business and every shop that has no roles gets its default roles.
//   5. Every approved shop whose business has nobody gives its applicant the owner role of the business.
//   6. Warns about stored roles that hold keys no longer in the catalogue.
// Changes are written as the "Access sync" actor, so they show up in ActivityLog with source SEED.
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { validateTemplates } from "../lib/access/role-templates"
import { findOwnerRole, seedBusinessRoles, seedPlatformRoles, seedShopRoles } from "../lib/access/role-seed"
import { isKnownKey } from "../lib/access/catalogue"
import { serializeActor, systemActor } from "../lib/audit/actor"

const dry = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const problems = validateTemplates()
    if (problems.length) {
        console.error("Role templates are invalid:\n- " + problems.join("\n- "))
        process.exitCode = 1
        return
    }

    const log: string[] = []

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Access sync"))}, true)`

        // 1. Platform roles
        if ((await tx.accessRole.count({ where: { scope: "PLATFORM" } })) === 0) {
            log.push("create the default platform roles")
            if (!dry) await seedPlatformRoles(tx)
        }

        // 2. Existing admins get the platform role that holds "everything"
        const superRole = await tx.accessRole.findFirst({
            where: { scope: "PLATFORM", permissions: { has: "*" } },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
        })
        const admins = await tx.user.findMany({
            where: { role: "ADMIN", deletedAt: null, accessAssignments: { none: { scope: "PLATFORM" } } },
            select: { id: true, email: true },
        })
        for (const u of admins) {
            log.push(`give ${superRole?.name ?? "the full platform role"} to ${u.email}`)
            if (!dry && superRole) {
                await tx.accessAssignment.create({
                    data: { userId: u.id, roleId: superRole.id, scope: "PLATFORM", status: "ACTIVE" },
                })
            }
        }

        // 3. Shops without a business
        const orphans = await tx.provider.findMany({ where: { businessId: null }, select: { id: true, businessName: true } })
        for (const shop of orphans) {
            log.push(`create a business for the shop "${shop.businessName}"`)
            if (!dry) {
                const business = await tx.business.create({ data: { name: shop.businessName }, select: { id: true } })
                await tx.provider.update({ where: { id: shop.id }, data: { businessId: business.id } })
            }
        }

        // 4. Default roles for every business and shop that has none
        const businesses = await tx.business.findMany({ select: { id: true, name: true } })
        for (const b of businesses) {
            if ((await tx.accessRole.count({ where: { scope: "BUSINESS", businessId: b.id } })) === 0) {
                log.push(`default roles for the business "${b.name}"`)
                if (!dry) await seedBusinessRoles(tx, b.id)
            }
        }
        const shops = await tx.provider.findMany({ select: { id: true, businessName: true } })
        for (const s of shops) {
            if ((await tx.accessRole.count({ where: { scope: "SHOP", providerId: s.id } })) === 0) {
                log.push(`default roles for the shop "${s.businessName}"`)
                if (!dry) await seedShopRoles(tx, s.id)
            }
        }

        // 5. Approved shops: the business gets its owner (the applicant)
        const needOwner = await tx.provider.findMany({
            where: { isVerified: true, deletedAt: null, business: { accessAssignments: { none: {} } } },
            select: { userId: true, businessName: true, businessId: true },
        })
        const done = new Set<string>()
        for (const shop of needOwner) {
            if (!shop.businessId || done.has(shop.businessId)) continue
            done.add(shop.businessId)
            const role = await findOwnerRole(tx, { businessId: shop.businessId })
            if (!role) {
                log.push(`WARNING no role can own the business of "${shop.businessName}"`)
                continue
            }
            log.push(`make the applicant of "${shop.businessName}" its owner (${role.name})`)
            if (!dry) {
                await tx.accessAssignment.create({
                    data: { userId: shop.userId, roleId: role.id, scope: "BUSINESS", businessId: shop.businessId, status: "ACTIVE" },
                })
            }
        }

        // 6. Stale keys in stored roles
        const stored = await tx.accessRole.findMany({ select: { name: true, scope: true, permissions: true } })
        for (const r of stored) {
            const unknown = r.permissions.filter((k) => !isKnownKey(r.scope, k))
            if (unknown.length) log.push(`WARNING role "${r.name}" (${r.scope}) holds unknown keys: ${unknown.join(", ")}`)
        }
    })

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
