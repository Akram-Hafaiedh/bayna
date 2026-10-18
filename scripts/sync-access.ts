// scripts/sync-access.ts
// Stores the system roles from lib/access/roles.ts in the database and gives existing people the
// roles they need. Safe to run repeatedly.
//
//   npm run access:sync              apply
//   npm run access:sync -- --dry     show what would change, change nothing
//
// What it does
//   1. Creates or updates every system role (name, description, permission list).
//   2. Every user with User.role = ADMIN and no platform assignment becomes SUPER_ADMIN
//      (today's admins already have full power; narrow them afterwards if you want).
//   3. Every verified shop that nobody has an assignment for gives its applicant the OWNER role:
//      business-level for a shop that belongs to a business, shop-level for one that does not yet
//      (before `npm run db:backfill-businesses`).
//   4. Warns about stored roles that hold keys no longer in the catalogue.
// Changes are written as the "Access sync" actor, so they show up in ActivityLog with source SEED.
import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { SYSTEM_ROLES, SUPER_ADMIN_KEY, OWNER_KEY, validateSystemRoles } from "../lib/access/roles"
import { isKnownKey } from "../lib/access/catalogue"
import { serializeActor, systemActor } from "../lib/audit/actor"

const dry = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
    const problems = validateSystemRoles()
    if (problems.length) {
        console.error("System role definitions are invalid:\n- " + problems.join("\n- "))
        process.exitCode = 1
        return
    }

    const log: string[] = []

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("SEED", "Access sync"))}, true)`

        // 1. System roles
        const roleIds = new Map<string, string>() // "SCOPE:KEY" -> id
        for (const def of SYSTEM_ROLES) {
            const existing = await tx.accessRole.findFirst({
                where: { scope: def.scope, providerId: null, key: def.key },
            })
            if (!existing) {
                log.push(`create role ${def.scope}:${def.key} (${def.permissions.length} permissions)`)
                if (!dry) {
                    const created = await tx.accessRole.create({
                        data: { ...def, providerId: null, isSystem: true },
                    })
                    roleIds.set(`${def.scope}:${def.key}`, created.id)
                }
                continue
            }
            roleIds.set(`${def.scope}:${def.key}`, existing.id)
            const same =
                existing.name === def.name &&
                existing.description === def.description &&
                existing.isSystem &&
                existing.permissions.length === def.permissions.length &&
                existing.permissions.every((k, i) => k === def.permissions[i])
            if (!same) {
                log.push(`update role ${def.scope}:${def.key}`)
                if (!dry) {
                    await tx.accessRole.update({
                        where: { id: existing.id },
                        data: { name: def.name, description: def.description, permissions: def.permissions, isSystem: true },
                    })
                }
            }
        }

        // 2. Existing admins become SUPER_ADMIN
        const superId = roleIds.get(`PLATFORM:${SUPER_ADMIN_KEY}`)
        const admins = await tx.user.findMany({
            where: { role: "ADMIN", deletedAt: null, accessAssignments: { none: { scope: "PLATFORM" } } },
            select: { id: true, email: true },
        })
        for (const u of admins) {
            log.push(`assign SUPER_ADMIN to ${u.email}`)
            if (!dry && superId) {
                await tx.accessAssignment.create({
                    data: { userId: u.id, roleId: superId, scope: "PLATFORM", status: "ACTIVE" },
                })
            }
        }

        // 3. Verified shops get their owner
        const shopOwnerId = roleIds.get(`SHOP:${OWNER_KEY}`)
        const businessOwnerId = roleIds.get(`BUSINESS:${OWNER_KEY}`)
        const shops = await tx.provider.findMany({
            where: {
                isVerified: true,
                deletedAt: null,
                accessAssignments: { none: {} },
                OR: [{ businessId: null }, { business: { accessAssignments: { none: {} } } }],
            },
            select: { id: true, userId: true, businessName: true, businessId: true },
        })
        const doneBusinesses = new Set<string>()
        for (const shop of shops) {
            if (shop.businessId) {
                if (doneBusinesses.has(shop.businessId)) continue // several shops, one business owner
                doneBusinesses.add(shop.businessId)
                log.push(`assign business OWNER of "${shop.businessName}" to its applicant`)
                if (!dry && businessOwnerId) {
                    await tx.accessAssignment.create({
                        data: { userId: shop.userId, roleId: businessOwnerId, scope: "BUSINESS", businessId: shop.businessId, status: "ACTIVE" },
                    })
                }
            } else {
                log.push(`assign OWNER of "${shop.businessName}" to its applicant`)
                if (!dry && shopOwnerId) {
                    await tx.accessAssignment.create({
                        data: { userId: shop.userId, roleId: shopOwnerId, scope: "SHOP", providerId: shop.id, status: "ACTIVE" },
                    })
                }
            }
        }

        // 4. Stale keys in stored roles
        const stored = await tx.accessRole.findMany({ select: { key: true, scope: true, permissions: true } })
        for (const r of stored) {
            const unknown = r.permissions.filter((k) => !isKnownKey(r.scope, k))
            if (unknown.length) log.push(`WARNING ${r.scope}:${r.key} holds unknown keys: ${unknown.join(", ")}`)
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
