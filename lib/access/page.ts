// lib/access/page.ts
// For Server Component pages: which of these shop permissions does the signed-in person hold?
// Pages only use this to show or hide controls. Every API route still checks permissions itself.
import { auth } from "@/auth"
import { loadAccess } from "./load"
import { can } from "./evaluate"
import type { BusinessPermission, PlatformPermission, ShopPermission } from "./catalogue"

export async function shopCan<K extends ShopPermission>(shopId: string, keys: readonly K[]): Promise<Record<K, boolean>> {
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    const now = new Date()
    // A business-level role (owner, accountant) counts inside every shop of its business. loadAccess
    // already knows which shops belong to which business, so no extra query is needed.
    const businessId = access
        ? (Object.entries(access.businessShops).find(([, shops]) => shops.includes(shopId))?.[0] ?? null)
        : null
    const out = {} as Record<K, boolean>
    for (const k of keys) {
        out[k] = !!access && access.status === "ACTIVE" && can(access.assignments, k, { shopId, businessId }, now)
    }
    return out
}

/** The same for business-level keys: what may this person do for this business? */
export async function businessCan<K extends BusinessPermission | ShopPermission>(
    businessId: string,
    keys: readonly K[]
): Promise<Record<K, boolean>> {
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    const now = new Date()
    const out = {} as Record<K, boolean>
    for (const k of keys) {
        out[k] = !!access && access.status === "ACTIVE" && can(access.assignments, k, { businessId }, now)
    }
    return out
}

/** The same for platform keys: what may this person do for the platform (the admin area)? */
export async function platformCan<K extends PlatformPermission>(keys: readonly K[]): Promise<Record<K, boolean>> {
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    const now = new Date()
    const out = {} as Record<K, boolean>
    for (const k of keys) {
        out[k] = !!access && access.status === "ACTIVE" && can(access.assignments, k, {}, now)
    }
    return out
}
