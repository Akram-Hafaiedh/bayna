// lib/access/reach.ts
// Which shops can a person work in? Their own shop-level assignments, plus every shop of each
// business they hold a business-level assignment for. Pure (unit tested).
import { isLive, type AssignmentInput } from "./evaluate"

/**
 * @param shopsByBusiness business id -> ids of that business's live shops
 * @returns distinct shop ids, sorted
 */
export function reachableShopIds(
    assignments: readonly AssignmentInput[],
    shopsByBusiness: Readonly<Record<string, readonly string[]>>,
    now: Date = new Date()
): string[] {
    const ids = new Set<string>()
    for (const a of assignments) {
        if (!isLive(a, now)) continue
        if (a.scope === "SHOP" && a.providerId) ids.add(a.providerId)
        if (a.scope === "BUSINESS" && a.businessId) {
            for (const shop of shopsByBusiness[a.businessId] ?? []) ids.add(shop)
        }
    }
    return [...ids].sort()
}

/** Ids of the businesses the person holds a live business-level assignment for, sorted. */
export function reachableBusinessIds(assignments: readonly AssignmentInput[], now: Date = new Date()): string[] {
    const ids = new Set<string>()
    for (const a of assignments) {
        if (isLive(a, now) && a.scope === "BUSINESS" && a.businessId) ids.add(a.businessId)
    }
    return [...ids].sort()
}
