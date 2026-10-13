// lib/product-filters.ts
// Pure (no database) helpers for the provider product list: filter types,
// URL parsing and URL building. Safe to import from server AND client components.
import { Unit } from "@/app/generated/prisma/enums"

export const LOW_STOCK_THRESHOLD = 5
export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
export const SORT_KEYS = ["updatedAt", "name", "price", "stock"] as const
export const PRODUCTS_PATH = "/provider/products"

export type SortKey = (typeof SORT_KEYS)[number]
export type StatusFilter = "all" | "active" | "hidden"
export type StockFilter = "all" | "low" | "out"
export type LinkedFilter = "all" | "yes" | "no"

export type ProductFilters = {
    q: string
    categoryId: string | null
    status: StatusFilter
    stock: StockFilter
    linked: LinkedFilter
    unit: Unit | null
    sort: SortKey
    dir: "asc" | "desc"
    page: number
    pageSize: number
}

/** Newest first for dates, A -> Z / low -> high for everything else. */
export function defaultDir(sort: SortKey): "asc" | "desc" {
    return sort === "updatedAt" ? "desc" : "asc"
}

// ---------------------------------------------------------------------------
// Parsing: accepts URLSearchParams (API) or the searchParams object (pages)
// ---------------------------------------------------------------------------
type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function pick(raw: RawParams, key: string): string | undefined {
    if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined
    const v = raw[key]
    return Array.isArray(v) ? v[0] : v
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

function toPositiveInt(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(value ?? "", 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

export function parseProductFilters(raw: RawParams): ProductFilters {
    const unit = pick(raw, "unit")
    const pageSize = toPositiveInt(pick(raw, "pageSize"), DEFAULT_PAGE_SIZE)
    const sort = oneOf(pick(raw, "sort"), SORT_KEYS, "updatedAt")

    return {
        q: (pick(raw, "q") ?? "").trim().slice(0, 100),
        categoryId: pick(raw, "category") || null,
        status: oneOf(pick(raw, "status"), ["all", "active", "hidden"] as const, "all"),
        stock: oneOf(pick(raw, "stock"), ["all", "low", "out"] as const, "all"),
        linked: oneOf(pick(raw, "linked"), ["all", "yes", "no"] as const, "all"),
        unit: unit && (Object.values(Unit) as string[]).includes(unit) ? (unit as Unit) : null,
        sort,
        dir: oneOf(pick(raw, "dir"), ["asc", "desc"] as const, defaultDir(sort)),
        page: toPositiveInt(pick(raw, "page"), 1),
        pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    }
}

// ---------------------------------------------------------------------------
// Building URLs (defaults are left out so URLs stay short)
// ---------------------------------------------------------------------------
/** Changing anything except `page` sends you back to page 1. */
export function buildProductsHref(
    current: ProductFilters,
    overrides: Partial<ProductFilters> = {}
): string {
    const next: ProductFilters = { ...current, ...overrides }
    if (!("page" in overrides)) next.page = 1

    const p = new URLSearchParams()
    if (next.q) p.set("q", next.q)
    if (next.categoryId) p.set("category", next.categoryId)
    if (next.status !== "all") p.set("status", next.status)
    if (next.stock !== "all") p.set("stock", next.stock)
    if (next.linked !== "all") p.set("linked", next.linked)
    if (next.unit) p.set("unit", next.unit)
    if (next.sort !== "updatedAt") p.set("sort", next.sort)
    if (next.dir !== defaultDir(next.sort)) p.set("dir", next.dir)
    if (next.page > 1) p.set("page", String(next.page))
    if (next.pageSize !== DEFAULT_PAGE_SIZE) p.set("pageSize", String(next.pageSize))

    const qs = p.toString()
    return qs ? `${PRODUCTS_PATH}?${qs}` : PRODUCTS_PATH
}

export function hasActiveFilters(f: ProductFilters): boolean {
    return Boolean(
        f.q || f.categoryId || f.unit || f.status !== "all" || f.stock !== "all" || f.linked !== "all"
    )
}
