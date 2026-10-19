// lib/access/page.ts
// For Server Component pages: which of these shop permissions does the signed-in person hold?
// Pages only use this to show or hide controls. Every API route still checks permissions itself.
import { auth } from "@/auth"
import { loadAccess } from "./load"
import { can } from "./evaluate"
import type { BusinessPermission, ShopPermission } from "./catalogue"

export async function shopCan<K extends ShopPermission>(providerId: string, keys: readonly K[]): Promise<Record<K, boolean>> {
    const session = await auth()
    const access = session?.user?.id ? await loadAccess(session.user.id) : null
    const now = new Date()
    // A business-level role (owner, accountant) counts inside every shop of its business. loadAccess
    // already knows which shops belong to which business, so no extra query is needed.
    const businessId = access
        ? (Object.entries(access.businessShops).find(([, shops]) => shops.includes(providerId))?.[0] ?? null)
        : null
    const out = {} as Record<K, boolean>
    for (const k of keys) {
        out[k] = !!access && access.status === "ACTIVE" && can(access.assignments, k, { providerId, businessId }, now)
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
