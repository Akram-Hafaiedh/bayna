// lib/access/sync.ts
// Sets up roles and owners for the data that exists. Safe to run repeatedly. Used by
// `npm run access:sync` (scripts/sync-access.ts) and by the `access` seeder (prisma/seed).
//
// Roles are ordinary rows owned by the platform, a business or a shop (see role-seed.ts). This only
// fills in what is missing, it never rewrites a role someone has edited.
//   1. Platform roles (Super admin, Admin, Support agent ...) are created if there are none.
//   2. Every user with User.role = ADMIN and no platform assignment gets the platform "everything" role.
//   3. Every business and every shop that has no roles gets its default roles.
//   4. Every approved shop whose business has nobody gives its applicant the owner role of the business.
//   5. Warns about stored roles that hold keys no longer in the catalogue.
// Changes are written as the "Access sync" actor, so they show up in ActivityLog with source SEED.
import type { PrismaClient } from "../../app/generated/prisma/client"
import { validateTemplates } from "./role-templates"
import { findOwnerRole, seedBusinessRoles, seedPlatformRoles, seedShopRoles } from "./role-seed"
import { isKnownKey } from "./catalogue"
import { serializeActor, systemActor } from "../audit/actor"

/** What was (or, with dry, would be) done, one line each. Lines starting with WARNING need a look. */
export async function syncAccess(prisma: PrismaClient, opts: { dry?: boolean } = {}): Promise<string[]> {
    const dry = !!opts.dry
    const problems = validateTemplates()
    if (problems.length) throw new Error("Role templates are invalid:\n- " + problems.join("\n- "))

    const log: string[] = []

    await prisma.$transaction(
        async (tx) => {
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

            // 3. Default roles for every business and shop that has none
            const businesses = await tx.business.findMany({ select: { id: true, name: true } })
            for (const b of businesses) {
                if ((await tx.accessRole.count({ where: { scope: "BUSINESS", businessId: b.id } })) === 0) {
                    log.push(`default roles for the business "${b.name}"`)
                    if (!dry) await seedBusinessRoles(tx, b.id)
                }
            }
            const shops = await tx.shop.findMany({ select: { id: true, name: true } })
            for (const s of shops) {
                if ((await tx.accessRole.count({ where: { scope: "SHOP", shopId: s.id } })) === 0) {
                    log.push(`default roles for the shop "${s.name}"`)
                    if (!dry) await seedShopRoles(tx, s.id)
                }
            }

            // 4. Approved shops: the business gets its owner (the applicant)
            const needOwner = await tx.shop.findMany({
                where: { status: "ACTIVE", deletedAt: null, business: { accessAssignments: { none: {} } } },
                select: { applicantId: true, name: true, businessId: true },
            })
            const done = new Set<string>()
            for (const shop of needOwner) {
                if (done.has(shop.businessId)) continue
                done.add(shop.businessId)
                const role = await findOwnerRole(tx, { businessId: shop.businessId })
                if (!role) {
                    log.push(`WARNING no role can own the business of the shop "${shop.name}"`)
                    continue
                }
                log.push(`make the applicant of the shop "${shop.name}" the owner of its business (${role.name})`)
                if (!dry) {
                    await tx.accessAssignment.create({
                        data: { userId: shop.applicantId, roleId: role.id, scope: "BUSINESS", businessId: shop.businessId, status: "ACTIVE" },
                    })
                }
            }

            // 5. Stale keys in stored roles
            const stored = await tx.accessRole.findMany({ select: { name: true, scope: true, permissions: true } })
            for (const r of stored) {
                const unknown = r.permissions.filter((k) => !isKnownKey(r.scope, k))
                if (unknown.length) log.push(`WARNING role "${r.name}" (${r.scope}) holds unknown keys: ${unknown.join(", ")}`)
            }
        },
        { timeout: 60_000 }
    )

    return log
}
