// lib/access/active-business.ts
// Which business the Business area is showing, for a person who belongs to several. Pure (unit tested).
//
// Like the active shop, the choice is remembered in a cookie that is only a hint: it is checked
// against the businesses the person really holds a business-level role in, on every request.
// Order: the hint, then the business of the shop they are working in, then the first by id.

/** Name of the cookie that remembers the chosen business. */
export const ACTIVE_BUSINESS_COOKIE = "bayna_business"

export function pickActiveBusiness(
    reachable: readonly string[],
    hint?: string | null,
    ofActiveShop?: string | null
): string | null {
    const ids = [...new Set(reachable)].sort()
    if (ids.length === 0) return null
    if (hint && ids.includes(hint)) return hint
    if (ofActiveShop && ids.includes(ofActiveShop)) return ofActiveShop
    return ids[0]
}
