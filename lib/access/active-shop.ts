// lib/access/active-shop.ts
// Which shop is "the one I am working in" for someone who belongs to several. Pure (unit tested).
//
// The choice is remembered in a cookie, but the cookie is only a hint. It is checked against the
// person's live shop assignments on every request, so a copied, edited or stale cookie can never
// open a shop the person does not work in. Without a valid hint the first shop (by id) is used.

/** Name of the cookie that remembers the chosen shop. */
export const ACTIVE_SHOP_COOKIE = "bayna_shop"

export function pickActiveShop(liveShopIds: readonly string[], hint?: string | null): string | null {
    const ids = [...new Set(liveShopIds)].sort()
    if (ids.length === 0) return null
    if (hint && ids.includes(hint)) return hint
    return ids[0]
}
