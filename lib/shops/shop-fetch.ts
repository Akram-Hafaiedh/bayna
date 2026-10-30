// lib/shops/shop-fetch.ts
// fetch() for the shop pages' API calls. It adds the shop of the page you are on (from the address) as a
// header, so the server acts on that shop even when another tab has switched to a different one.
// The server still checks that you work in the shop; the header only says which one is meant.
import { SHOP_HEADER, parseShopPath } from "@/lib/shops/shop-paths"

export function shopFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const shop = typeof window === "undefined" ? null : parseShopPath(window.location.pathname)
    if (!shop) return fetch(input, init)
    const headers = new Headers(init.headers)
    headers.set(SHOP_HEADER, shop.publicShopId)
    return fetch(input, { ...init, headers })
}
