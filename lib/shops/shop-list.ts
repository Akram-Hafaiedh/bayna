// lib/shops/shop-list.ts
// Search and status filter of the shops list in the Business area. Pure (unit tested).
import type { ShopStatusValue } from "./shop-status"

export type ShopRow = {
    id: string
    publicShopId: string
    name: string
    city: string
    governorate: string | null
    status: ShopStatusValue
    products: number
    team: number
    /** required details already filled in, and how many there are */
    setupDone: number
    setupTotal: number
    /** the person can open this shop's dashboard (a live shop their role reaches) */
    openable: boolean
}

export type ShopFilters = { q: string; status: "all" | ShopStatusValue }

export const NO_SHOP_FILTERS: ShopFilters = { q: "", status: "all" }

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function filterShops(rows: readonly ShopRow[], f: ShopFilters): ShopRow[] {
    const q = fold(f.q.trim())
    return rows.filter((r) => {
        if (f.status !== "all" && r.status !== f.status) return false
        if (!q) return true
        return fold([r.name, r.city, r.governorate ?? ""].join(" ")).includes(q)
    })
}

/** How many shops are in each status (for the filter's labels); only statuses that occur are listed. */
export function countByStatus(rows: readonly ShopRow[]): Partial<Record<ShopStatusValue, number>> {
    const out: Partial<Record<ShopStatusValue, number>> = {}
    for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
    return out
}
