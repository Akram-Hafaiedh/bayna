// lib/access/my-businesses.ts
// The businesses a person holds a business-level role in (what the Business area is about), with
// the one that is active. Server only. Used by the Business pages, the picker and the account menu.
import { prisma } from "@/lib/prisma"
import { loadAccess, type Access } from "./load"
import { pickActiveBusiness } from "./active-business"
import { readActiveBusinessHint } from "./active-business-cookie"
import { pickActiveShop } from "./active-shop"
import { readActiveShopHint } from "./active-cookie"
import { reachableBusinessIds, reachableShopIds } from "./reach"

export type MyBusiness = { id: string; name: string; /** shops it has, so two businesses are never just two identical names */ shopCount: number }

export type MyBusinesses = {
    access: Access
    businesses: MyBusiness[]
    activeId: string | null
}

/** null when the person is not signed in or holds no business-level role. */
export async function loadMyBusinesses(userId: string, now: Date = new Date()): Promise<MyBusinesses | null> {
    const access = await loadAccess(userId)
    if (!access || access.status !== "ACTIVE") return null

    const reachable = reachableBusinessIds(access.assignments, now)
    if (reachable.length === 0) return null

    const rows = await prisma.business.findMany({
        where: { id: { in: reachable }, deletedAt: null },
        select: { id: true, name: true, _count: { select: { shops: { where: { deletedAt: null } } } } },
    })
    const businesses: MyBusiness[] = rows
        .map((r) => ({ id: r.id, name: r.name, shopCount: r._count.shops }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    if (businesses.length === 0) return null

    // The business of the shop they are working in is the fallback when nothing was chosen
    const hint = await readActiveBusinessHint()
    let ofActiveShop: string | null = null
    if (!(hint && businesses.some((b) => b.id === hint))) {
        const shopIds = reachableShopIds(access.assignments, access.businessShops, now)
        const activeShop = pickActiveShop(shopIds, await readActiveShopHint())
        if (activeShop) {
            const shop = await prisma.shop.findUnique({ where: { id: activeShop }, select: { businessId: true } })
            ofActiveShop = shop?.businessId ?? null
        }
    }
    const activeId = pickActiveBusiness(businesses.map((b) => b.id), hint, ofActiveShop)
    return { access, businesses, activeId }
}
