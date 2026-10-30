// lib/access/role-seed.ts
// Copies the default roles (role-templates.ts) into a business, a shop, or the platform as ordinary
// rows, and finds "the role that can own" a level. Server only. Uses relative imports so the seed
// scripts can use it too.
import type { Tx } from "../audit/run"
import { OWNERSHIP_KEY, holdsKey } from "./catalogue"
import { templatesFor } from "./role-templates"

type Owner =
    | { scope: "PLATFORM" }
    | { scope: "BUSINESS"; businessId: string }
    | { scope: "SHOP"; shopId: string }

const ownerWhere = (o: Owner) =>
    o.scope === "PLATFORM"
        ? { scope: "PLATFORM" as const, businessId: null, shopId: null }
        : o.scope === "BUSINESS"
            ? { scope: "BUSINESS" as const, businessId: o.businessId, shopId: null }
            : { scope: "SHOP" as const, businessId: null, shopId: o.shopId }

/**
 * Gives a new owner its default roles. Only does anything when the owner has no roles at all, so it is
 * safe to call again and never brings back a default role the owner deleted on purpose.
 * Returns the number created.
 */
export async function seedRoles(tx: Tx, owner: Owner): Promise<number> {
    const where = ownerWhere(owner)
    if ((await tx.accessRole.count({ where })) > 0) return 0
    const templates = templatesFor(owner.scope)
    await tx.accessRole.createMany({
        data: templates.map((t) => ({ ...where, name: t.name, description: t.description, permissions: t.permissions })),
    })
    return templates.length
}

export const seedBusinessRoles = (tx: Tx, businessId: string) => seedRoles(tx, { scope: "BUSINESS", businessId })
export const seedShopRoles = (tx: Tx, shopId: string) => seedRoles(tx, { scope: "SHOP", shopId })
export const seedPlatformRoles = (tx: Tx) => seedRoles(tx, { scope: "PLATFORM" })

/**
 * The role to give a new owner: of the business (business-level owner) or of a shop. There is no
 * special "Owner" role, so this is the role that holds the ownership key with the most permissions
 * (a role with "*" wins), oldest first. null when the owner has deleted every such role.
 */
export async function findOwnerRole(tx: Tx, target: { businessId: string } | { shopId: string }): Promise<{ id: string; name: string } | null> {
    const business = "businessId" in target
    const rows = await tx.accessRole.findMany({
        where: business ? ownerWhere({ scope: "BUSINESS", businessId: target.businessId }) : ownerWhere({ scope: "SHOP", shopId: target.shopId }),
        select: { id: true, name: true, permissions: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    })
    const key = business ? OWNERSHIP_KEY.BUSINESS : OWNERSHIP_KEY.SHOP
    const owners = rows.filter((r) => holdsKey(r.permissions, key))
    if (owners.length === 0) return null
    const weight = (r: { permissions: string[] }) => (r.permissions.includes("*") ? Number.MAX_SAFE_INTEGER : r.permissions.length)
    owners.sort((a, b) => weight(b) - weight(a) || a.createdAt.getTime() - b.createdAt.getTime())
    return { id: owners[0].id, name: owners[0].name }
}

/** A name is free at this owner (case-insensitive)? For creating or renaming a role. */
export async function roleNameFree(tx: Tx, owner: Owner, name: string, exceptId?: string): Promise<boolean> {
    const rows = await tx.accessRole.findMany({ where: ownerWhere(owner), select: { id: true, name: true } })
    const wanted = name.trim().toLowerCase()
    return !rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === wanted)
}
