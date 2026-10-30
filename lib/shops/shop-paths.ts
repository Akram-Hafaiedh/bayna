// lib/shop-paths.ts
// URLs of the shop area. A shop's pages live under /shop/[publicShopId]/..., so the address says which
// shop you are working in (bookmarkable, and two tabs can show two shops). "/shop" alone is the
// landing: it opens the shop you used last. Pure, no server code, so pages, components and tests can share it.

export const SHOP_HOME = "/shop"

/** Header the browser sends with API calls so the server knows which shop the page is about. */
export const SHOP_HEADER = "x-shop"

/** shopPath("abc", "team") is "/shop/abc/team"; without a section it is the shop's dashboard. */
export function shopPath(publicShopId: string, section = "dashboard"): string {
    const s = section.replace(/^\/+/, "")
    return `/shop/${publicShopId}${s ? `/${s}` : ""}`
}

/** Splits "/shop/abc/products/new" into the shop's public id and the rest ("products/new"). */
export function parseShopPath(pathname: string | null | undefined): { publicShopId: string; section: string } | null {
    if (!pathname) return null
    const m = /^\/shop\/([^/]+)(?:\/(.*))?$/.exec(pathname)
    if (!m) return null
    return { publicShopId: decodeURIComponent(m[1]), section: (m[2] ?? "").replace(/\/+$/, "") }
}

/** Link to a section of "the shop I used last" (the landing resolves it): used where no shop is in the address. */
export function lastShopPath(section = ""): string {
    return section ? `${SHOP_HOME}?to=${encodeURIComponent(section)}` : SHOP_HOME
}

/** A section name that is safe to put after /shop/<id>/ (letters, digits, dashes and slashes only). */
export function cleanSection(raw: string | null | undefined): string {
    const s = (raw ?? "").trim().replace(/^\/+|\/+$/g, "")
    return /^[a-z0-9][a-z0-9/-]*$/i.test(s) && !s.includes("//") && !s.includes("..") ? s : ""
}
