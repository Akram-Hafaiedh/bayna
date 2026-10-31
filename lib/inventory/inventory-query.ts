// lib/inventory/inventory-query.ts
// The filters of the inventory view (stock per product and warehouse), kept in the address so a view can be
// bookmarked and shared. Pure (unit tested).

export const INVENTORY_PAGE_SIZES = [25, 50, 100] as const
export const INVENTORY_DEFAULT_PAGE_SIZE = 25

export type InventoryStockFilter = "all" | "low" | "out"

export type InventoryQuery = {
    q: string
    /** Only this warehouse's stock (and low / out are judged in it); null = all warehouses together */
    warehouseId: string | null
    stock: InventoryStockFilter
    page: number
    pageSize: number
}

type Raw = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function parseInventoryQuery(raw: Raw): InventoryQuery {
    const stock = one(raw.stock)
    const page = Number(one(raw.page))
    const size = Number(one(raw.pageSize))
    return {
        q: (one(raw.q) ?? "").trim().slice(0, 100),
        warehouseId: one(raw.warehouse) || null,
        stock: stock === "low" || stock === "out" ? stock : "all",
        page: Number.isInteger(page) && page >= 1 ? page : 1,
        pageSize: (INVENTORY_PAGE_SIZES as readonly number[]).includes(size) ? size : INVENTORY_DEFAULT_PAGE_SIZE,
    }
}

export const hasInventoryFilters = (q: InventoryQuery) => q.q !== "" || q.warehouseId !== null || q.stock !== "all"

/**
 * The address of the view with some filters changed. Anything but the page itself sends you back to page 1;
 * values that are the default are left out, so the plain view has a plain address.
 */
export function buildInventoryHref(base: string, current: InventoryQuery, patch: Partial<InventoryQuery> = {}): string {
    const next: InventoryQuery = { ...current, ...patch }
    if (!("page" in patch)) next.page = 1
    const p = new URLSearchParams()
    if (next.q) p.set("q", next.q)
    if (next.warehouseId) p.set("warehouse", next.warehouseId)
    if (next.stock !== "all") p.set("stock", next.stock)
    if (next.pageSize !== INVENTORY_DEFAULT_PAGE_SIZE) p.set("pageSize", String(next.pageSize))
    if (next.page > 1) p.set("page", String(next.page))
    const s = p.toString()
    return s ? `${base}?${s}` : base
}
