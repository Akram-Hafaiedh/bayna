// lib/access/role-pages.ts
// What the role screens need on the server: for one business or shop, what this person may do with its
// roles (view, manage, which keys they may hand out), the roles as list rows, and one role for the
// editor. Server only. The routes check everything again; this only decides what to show.
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { requireBusinessArea } from "@/lib/business-auth"
import { loadAccess, type Access } from "./load"
import { ALL_BUSINESS_KEYS, ALL_SHOP_KEYS } from "./catalogue"
import { effective, has } from "./evaluate"
import { loadRoleRows } from "./roles-data"
import { targetOfRole } from "./role-actions"
import type { RoleListItem } from "./role-list"

/** One place that owns roles (a business or a shop), as this person can use it. */
export type OwnerOption = {
    scope: "BUSINESS" | "SHOP"
    /** the business id or the shop id */
    id: string
    label: string
    canView: boolean
    canManage: boolean
    /** every permission that can be chosen for a role of this owner */
    keys: string[]
    /** the keys this person holds, so the ones they may hand out */
    grantable: string[]
    canEverything: boolean
}

/** The shop a person is working in: its roles can hand out the roles of its business, so they may look at those. */
export type ViaShop = { id: string; businessId: string | null }

export function businessOwner(access: Access, business: { id: string; name: string }, via?: ViaShop | null): OwnerOption {
    const eff = effective(access.assignments, { businessId: business.id })
    const keys = [...ALL_BUSINESS_KEYS]
    const viaShop =
        !!via && via.businessId === business.id && has(effective(access.assignments, { shopId: via.id, businessId: business.id }), "team.role.view")
    return {
        scope: "BUSINESS",
        id: business.id,
        label: business.name,
        canView: has(eff, "business.role.view") || viaShop,
        canManage: has(eff, "business.role.manage"),
        keys,
        grantable: keys.filter((k) => has(eff, k)),
        canEverything: eff.all,
    }
}

export function shopOwner(access: Access, shop: { id: string; name: string }, businessId: string | null): OwnerOption {
    const eff = effective(access.assignments, { shopId: shop.id, businessId })
    const keys = [...ALL_SHOP_KEYS]
    return {
        scope: "SHOP",
        id: shop.id,
        label: shop.name,
        canView: has(eff, "team.role.view"),
        canManage: has(eff, "team.role.manage"),
        keys,
        grantable: keys.filter((k) => has(eff, k)),
        canEverything: eff.all,
    }
}

/** The roles of every owner this person may look at, as rows for the list screen. */
export async function loadRoleItems(owners: readonly OwnerOption[]): Promise<RoleListItem[]> {
    const lists = await Promise.all(
        owners
            .filter((o) => o.canView)
            .map(async (o) => {
                const rows = await loadRoleRows(
                    o.scope === "BUSINESS" ? { scope: "BUSINESS", businessId: o.id } : { scope: "SHOP", shopId: o.id },
                    (k) => o.canEverything || o.grantable.includes(k),
                    o.canManage
                )
                return rows.map((r): RoleListItem => ({ ...r, owner: { scope: o.scope, id: o.id, name: o.label } }))
            })
    )
    return lists.flat()
}

export type EditorRole = {
    id: string
    name: string
    description: string | null
    permissions: string[]
    members: number
    invites: number
    owner: OwnerOption
    /** this person may change it: they manage roles there and hold every key it holds */
    editable: boolean
}

/** One stored role for the editor, or null when it does not exist or this person may not look at it. */
export async function loadEditorRole(access: Access, roleId: string, via?: ViaShop | null): Promise<EditorRole | null> {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(roleId)) return null
    const role = await prisma.accessRole.findUnique({
        where: { id: roleId },
        select: { id: true, name: true, description: true, permissions: true, businessId: true, shopId: true },
    })
    if (!role) return null
    const target = targetOfRole(role)
    if (!target) return null // platform roles are not edited here

    let owner: OwnerOption
    if (target.scope === "BUSINESS") {
        const b = await prisma.business.findFirst({ where: { id: target.businessId, deletedAt: null }, select: { id: true, name: true } })
        if (!b) return null
        owner = businessOwner(access, b, via)
    } else {
        const s = await prisma.shop.findFirst({ where: { id: target.shopId, deletedAt: null }, select: { id: true, name: true, businessId: true } })
        if (!s) return null
        owner = shopOwner(access, s, s.businessId)
    }
    if (!owner.canView) return null

    const [members, invites] = await Promise.all([
        prisma.accessAssignment.count({ where: { roleId } }),
        prisma.accessInvite.count({ where: { roleId, status: "PENDING" } }),
    ])
    const holdsAll = role.permissions.every((k) => owner.canEverything || owner.grantable.includes(k))
    return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        members,
        invites,
        owner,
        editable: owner.canManage && holdsAll,
    }
}

export type ShopRolesContext =
    | { ready: false; reason: "not-approved" | "no-access" }
    | {
        ready: true
        access: Access
        shop: { id: string; name: string; /** the shop's address, "/shop/<publicShopId>" */ base: string }
        /** the shop's own roles first, then (when this person may look at them) the business's */
        owners: OwnerOption[]
        via: ViaShop
    }

/** Everything the shop-area role pages need: the active shop, who this is, and the places that own roles. */
export async function loadShopRolesContext(publicShopId: string): Promise<ShopRolesContext> {
    const shop = await requireShopPage(publicShopId)
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    if (shop?.status !== "ACTIVE" || !access) return { ready: false, reason: "not-approved" }

    const found = await prisma.shop.findUnique({
        where: { id: shop.id },
        select: { name: true, businessId: true, business: { select: { id: true, name: true, deletedAt: true } } },
    })
    const business = found?.business && !found.business.deletedAt ? found.business : null
    const via: ViaShop = { id: shop.id, businessId: business?.id ?? null }
    const shopOpt = shopOwner(access, { id: shop.id, name: found?.name ?? shop.name }, business?.id ?? null)
    const owners = [shopOpt, ...(business ? [businessOwner(access, business, via)] : [])]
    if (!owners.some((o) => o.canView)) return { ready: false, reason: "no-access" }
    return { ready: true, access, shop: { id: shop.id, name: found?.name ?? shop.name, base: shopPath(shop.publicShopId, "") }, owners, via }
}

/** Everything the Business-area role pages need: the business, who this is, and the business plus each of its shops as owners. */
export async function loadBusinessRolesContext(): Promise<{ access: Access; business: { id: string; name: string }; owners: OwnerOption[] }> {
    const { business, access } = await requireBusinessArea()
    const shops = await prisma.shop.findMany({
        where: { businessId: business.id, deletedAt: null, status: "ACTIVE" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
    })
    return {
        access,
        business: { id: business.id, name: business.name },
        owners: [businessOwner(access, business), ...shops.map((s) => shopOwner(access, s, business.id))],
    }
}
