// lib/inventory/inventory-view.ts
// The data of the inventory view: every product of the shop with its quantity in each warehouse.
// "Low" means at or below the reorder point set for that product in that warehouse (no reorder point, never low).
import { Prisma } from "@/app/generated/prisma/client"
import type { Unit } from "@/app/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type { InventoryQuery } from "@/lib/inventory/inventory-query"

export type InventoryLevel = { quantity: number; reorderPoint: number | null }

export type InventoryItem = {
    id: string
    name: string
    brand: string | null
    sku: string | null
    unit: Unit
    /** All warehouses together (Product.stock) */
    total: number
    /** By warehouse id; a warehouse missing here holds none of it */
    levels: Record<string, InventoryLevel>
}

export type InventoryPage = {
    items: InventoryItem[]
    total: number
    page: number
    pageSize: number
    pageCount: number
}

function searchClauses(q: string): Prisma.ProductWhereInput[] {
    return q.split(/\s+/).filter(Boolean).map((term) => ({
        OR: [
            { name: { contains: term, mode: "insensitive" } },
            { nameAr: { contains: term, mode: "insensitive" } },
            { brand: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
        ],
    }))
}

/** Ids of the shop's products that sit at or below their reorder point (and are not at 0) in a live warehouse. */
async function lowStockProductIds(shopId: string, warehouseId: string | null): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ productId: string }[]>(Prisma.sql`
        SELECT DISTINCT sl."productId"
          FROM "StockLevel" sl
          JOIN "Warehouse" w ON w."id" = sl."warehouseId"
         WHERE w."shopId" = ${shopId}
           AND w."archivedAt" IS NULL
           AND sl."quantity" > 0
           AND sl."reorderPoint" IS NOT NULL
           AND sl."quantity" <= sl."reorderPoint"
           ${warehouseId ? Prisma.sql`AND sl."warehouseId" = ${warehouseId}` : Prisma.empty}`)
    return rows.map((r) => r.productId)
}

export async function listInventory(shopId: string, q: InventoryQuery): Promise<InventoryPage> {
    const and: Prisma.ProductWhereInput[] = searchClauses(q.q)
    if (q.warehouseId) {
        // A warehouse is picked: judge its own quantity
        if (q.stock === "out") and.push({ stockLevels: { none: { warehouseId: q.warehouseId, quantity: { gt: 0 } } } })
        if (q.stock === "all") and.push({ stockLevels: { some: { warehouseId: q.warehouseId } } })
    } else if (q.stock === "out") {
        and.push({ stock: { lte: 0 } })
    }
    if (q.stock === "low") and.push({ id: { in: await lowStockProductIds(shopId, q.warehouseId) } })

    const where: Prisma.ProductWhereInput = { shopId, deletedAt: null, AND: and }
    const total = await prisma.product.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / q.pageSize))
    const page = Math.min(q.page, pageCount)

    const rows = await prisma.product.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
            id: true, name: true, brand: true, sku: true, unit: true, stock: true,
            stockLevels: { select: { warehouseId: true, quantity: true, reorderPoint: true } },
        },
    })
    const items: InventoryItem[] = rows.map((p) => ({
        id: p.id, name: p.name, brand: p.brand, sku: p.sku, unit: p.unit, total: p.stock,
        levels: Object.fromEntries(p.stockLevels.map((l) => [l.warehouseId, { quantity: l.quantity, reorderPoint: l.reorderPoint }])),
    }))
    return { items, total, page, pageSize: q.pageSize, pageCount }
}

/** What the inventory header shows: how many products are out, and how many are low, in the live warehouses. */
export async function inventoryCounts(shopId: string): Promise<{ products: number; out: number; low: number }> {
    const [products, out, low] = await Promise.all([
        prisma.product.count({ where: { shopId, deletedAt: null } }),
        prisma.product.count({ where: { shopId, deletedAt: null, stock: { lte: 0 } } }),
        lowStockProductIds(shopId, null),
    ])
    return { products, out, low: low.length }
}
