// lib/provider-products.ts
// Server-side querying for the provider's product list: search, filters, sort, pagination.
// Used by the API route today and by the products page (Server Component) next.
import type { Prisma } from "@/app/generated/prisma/client"
import type { SuggestionStatus, Unit } from "@/app/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { LOW_STOCK_THRESHOLD, type ProductFilters } from "@/lib/product-filters"

/** JSON-safe row (Decimal -> string, Date -> ISO) so it can cross into client components. */
export type ProductRow = {
    id: string
    name: string
    nameAr: string | null
    brand: string | null
    sku: string | null
    unit: Unit
    price: string
    stock: number
    isActive: boolean
    minOrderQty: number | null
    catalogItemId: string | null
    updatedAt: string
    /** When the shop last set or confirmed the price; null = from before this was tracked */
    priceUpdatedAt: string | null
    needsPriceReview: boolean
    priceReviewReason: string | null
    category: { id: string; name: string } | null
}

export type ProductPage = {
    items: ProductRow[]
    total: number
    page: number
    pageSize: number
    pageCount: number
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
const rowSelect = {
    id: true,
    name: true,
    nameAr: true,
    brand: true,
    sku: true,
    unit: true,
    price: true,
    stock: true,
    isActive: true,
    minOrderQty: true,
    catalogItemId: true,
    updatedAt: true,
    priceUpdatedAt: true,
    needsPriceReview: true,
    priceReviewReason: true,
    category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect

type RowRecord = Prisma.ProductGetPayload<{ select: typeof rowSelect }>

function toRow(p: RowRecord): ProductRow {
    return {
        ...p,
        price: p.price.toString(),
        updatedAt: p.updatedAt.toISOString(),
        priceUpdatedAt: p.priceUpdatedAt ? p.priceUpdatedAt.toISOString() : null,
    }
}

/** Every word must match at least one of name, Arabic name, brand or SKU. */
function searchClauses(q: string): Prisma.ProductWhereInput[] {
    return q
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => ({
            OR: [
                { name: { contains: term, mode: "insensitive" } },
                { nameAr: { contains: term, mode: "insensitive" } },
                { brand: { contains: term, mode: "insensitive" } },
                { sku: { contains: term, mode: "insensitive" } },
            ],
        }))
}

async function buildWhere(
    providerId: string,
    f: ProductFilters
): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = searchClauses(f.q)
    // Deleted products are hidden everywhere here; they live in the Trash (listTrash)

    if (f.categoryId) {
        // Picking a parent category also matches its sub-categories
        const children = await prisma.category.findMany({
            where: { parentId: f.categoryId },
            select: { id: true },
        })
        and.push({ categoryId: { in: [f.categoryId, ...children.map((c) => c.id)] } })
    }

    if (f.status === "active") and.push({ isActive: true })
    if (f.status === "hidden") and.push({ isActive: false })

    if (f.stock === "out") and.push({ stock: { lte: 0 } })
    if (f.stock === "low") and.push({ stock: { gt: 0, lt: LOW_STOCK_THRESHOLD } })

    if (f.linked === "yes") and.push({ catalogItemId: { not: null } })
    if (f.linked === "no") and.push({ catalogItemId: null })
    if (f.review === "yes") and.push({ needsPriceReview: true })

    if (f.unit) and.push({ unit: f.unit })

    return { providerId, deletedAt: null, AND: and }
}

export async function listProducts(
    providerId: string,
    filters: ProductFilters
): Promise<ProductPage> {
    const where = await buildWhere(providerId, filters)

    const total = await prisma.product.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))
    const page = Math.min(filters.page, pageCount) // out-of-range page -> last page

    const rows = await prisma.product.findMany({
        where,
        select: rowSelect,
        // id as tie-breaker keeps pagination stable when sort values repeat
        orderBy: [{ [filters.sort]: filters.dir } as Prisma.ProductOrderByWithRelationInput, { id: "asc" }],
        skip: (page - 1) * filters.pageSize,
        take: filters.pageSize,
    })

    return { items: rows.map(toRow), total, page, pageSize: filters.pageSize, pageCount }
}

// ---------------------------------------------------------------------------
// Header stats + filter options
// ---------------------------------------------------------------------------
export type ProductStats = {
    total: number
    hidden: number
    lowStock: number
    outOfStock: number
    needsReview: number
    /** Products in the trash */
    trashed: number
}

export async function getProductStats(providerId: string): Promise<ProductStats> {
    const live = { providerId, deletedAt: null }
    const [total, hidden, lowStock, outOfStock, needsReview, trashed] = await Promise.all([
        prisma.product.count({ where: live }),
        prisma.product.count({ where: { ...live, isActive: false } }),
        prisma.product.count({
            where: { ...live, stock: { gt: 0, lt: LOW_STOCK_THRESHOLD } },
        }),
        prisma.product.count({ where: { ...live, stock: { lte: 0 } } }),
        prisma.product.count({ where: { ...live, needsPriceReview: true } }),
        prisma.product.count({ where: { providerId, deletedAt: { not: null } } }),
    ])
    return { total, hidden, lowStock, outOfStock, needsReview, trashed }
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------
export type TrashRow = {
    id: string
    name: string
    brand: string | null
    sku: string | null
    unit: Unit
    price: string
    stock: number
    catalogItemId: string | null
    deletedAt: string
    deletedByName: string | null
    category: { id: string; name: string } | null
}

export const TRASH_LIMIT = 200

/** Removed products, most recently removed first. */
export async function listTrash(providerId: string): Promise<{ items: TrashRow[]; total: number }> {
    const where = { providerId, deletedAt: { not: null } } satisfies Prisma.ProductWhereInput
    const [total, rows] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
            where,
            orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
            take: TRASH_LIMIT,
            select: {
                id: true,
                name: true,
                brand: true,
                sku: true,
                unit: true,
                price: true,
                stock: true,
                catalogItemId: true,
                deletedAt: true,
                deletedById: true,
                category: { select: { id: true, name: true } },
            },
        }),
    ])

    const ids = [...new Set(rows.map((r) => r.deletedById).filter((v): v is string => !!v))]
    const people = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
        : []
    const names = new Map(people.map((u) => [u.id, u.name || u.email]))

    return {
        total,
        items: rows.map((r) => ({
            id: r.id,
            name: r.name,
            brand: r.brand,
            sku: r.sku,
            unit: r.unit,
            price: r.price.toString(),
            stock: r.stock,
            catalogItemId: r.catalogItemId,
            deletedAt: (r.deletedAt as Date).toISOString(),
            deletedByName: r.deletedById ? names.get(r.deletedById) ?? null : null,
            category: r.category,
        })),
    }
}

export type CategoryOption = {
    id: string
    name: string
    count: number
    children: { id: string; name: string; count: number }[]
}

/** Only categories this provider actually uses, grouped root -> sub-categories, with counts. */
export async function getFilterCategories(providerId: string): Promise<CategoryOption[]> {
    const groups = await prisma.product.groupBy({
        by: ["categoryId"],
        where: { providerId, deletedAt: null, categoryId: { not: null } },
        _count: { _all: true },
    })
    const counts = new Map(groups.map((g) => [g.categoryId as string, g._count._all]))
    const usedIds = [...counts.keys()]
    if (usedIds.length === 0) return []

    const categories = await prisma.category.findMany({
        where: { OR: [{ id: { in: usedIds } }, { children: { some: { id: { in: usedIds } } } }] },
        select: { id: true, name: true, parentId: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    const roots = new Map<string, CategoryOption>()
    for (const c of categories.filter((c) => !c.parentId)) {
        roots.set(c.id, { id: c.id, name: c.name, count: counts.get(c.id) ?? 0, children: [] })
    }
    for (const c of categories.filter((c) => c.parentId)) {
        const root = roots.get(c.parentId as string)
        const count = counts.get(c.id) ?? 0
        if (!root || count === 0) continue
        root.children.push({ id: c.id, name: c.name, count })
        root.count += count
    }
    return [...roots.values()].filter((r) => r.count > 0)
}

// ---------------------------------------------------------------------------
// Forms: full category tree + a single product for the edit page
// ---------------------------------------------------------------------------
export type CategoryTree = { id: string; name: string; children: { id: string; name: string }[] }

export async function getCategoryTree(): Promise<CategoryTree[]> {
    const categories = await prisma.category.findMany({
        select: { id: true, name: true, parentId: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    const roots = new Map<string, CategoryTree>()
    for (const c of categories.filter((c) => !c.parentId)) {
        roots.set(c.id, { id: c.id, name: c.name, children: [] })
    }
    for (const c of categories.filter((c) => c.parentId)) {
        roots.get(c.parentId as string)?.children.push({ id: c.id, name: c.name })
    }
    return [...roots.values()]
}

export type ProductDetail = {
    id: string
    name: string
    nameAr: string | null
    description: string | null
    brand: string | null
    sku: string | null
    unit: Unit
    categoryId: string | null
    price: string
    stock: number
    minOrderQty: number | null
    isActive: boolean
    priceUpdatedAt: string | null
    needsPriceReview: boolean
    priceReviewReason: string | null
    catalogItem: { id: string; name: string } | null
    /** Latest request to add this product to the shared catalogue, if any. */
    suggestion: { status: SuggestionStatus; reviewNote: string | null } | null
}

/** Returns null when the product does not exist or belongs to another provider. */
export async function getProviderProduct(
    providerId: string,
    id: string
): Promise<ProductDetail | null> {
    const p = await prisma.product.findFirst({
        where: { id, providerId, deletedAt: null },
        select: {
            id: true,
            name: true,
            nameAr: true,
            description: true,
            brand: true,
            sku: true,
            unit: true,
            categoryId: true,
            price: true,
            stock: true,
            minOrderQty: true,
            isActive: true,
            priceUpdatedAt: true,
            needsPriceReview: true,
            priceReviewReason: true,
            catalogItem: { select: { id: true, name: true } },
            suggestion: { select: { status: true, reviewNote: true } },
        },
    })
    return p
        ? { ...p, price: p.price.toString(), priceUpdatedAt: p.priceUpdatedAt ? p.priceUpdatedAt.toISOString() : null }
        : null
}
