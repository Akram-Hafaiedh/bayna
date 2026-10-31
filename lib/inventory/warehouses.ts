// lib/inventory/warehouses.ts
// Reads for the inventory screens and API: the shop's warehouses with their totals, and the stock history.
// Writes are in stock-actions.ts.
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import type { MovementQuery } from "@/lib/inventory/movement-query"

export type WarehouseRow = {
    id: string
    name: string
    address: string | null
    city: string
    governorate: string | null
    latitude: number | null
    longitude: number | null
    locationSource: string | null
    isDefault: boolean
    archivedAt: string | null
    /** Products with stock here, and the total number of units */
    productCount: number
    unitTotal: number
    /** Ledger rows: above 0 the warehouse can only be archived, never deleted */
    movementCount: number
}

export async function listWarehouses(shopId: string, opts: { includeArchived?: boolean } = {}): Promise<WarehouseRow[]> {
    const [rows, sums] = await Promise.all([
        prisma.warehouse.findMany({
            where: { shopId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            include: { _count: { select: { movements: true } } },
        }),
        prisma.stockLevel.groupBy({
            by: ["warehouseId"],
            where: { warehouse: { shopId }, quantity: { gt: 0 }, product: { deletedAt: null } },
            _sum: { quantity: true },
            _count: { _all: true },
        }),
    ])
    const byId = new Map(sums.map((s) => [s.warehouseId, s]))
    return rows.map((w) => ({
        id: w.id,
        name: w.name,
        address: w.address,
        city: w.city,
        governorate: w.governorate,
        latitude: w.latitude,
        longitude: w.longitude,
        locationSource: w.locationSource,
        isDefault: w.isDefault,
        archivedAt: w.archivedAt ? w.archivedAt.toISOString() : null,
        productCount: byId.get(w.id)?._count._all ?? 0,
        unitTotal: byId.get(w.id)?._sum.quantity ?? 0,
        movementCount: w._count.movements,
    }))
}

export type MovementRow = {
    id: string
    createdAt: string
    type: string
    quantity: number
    balanceAfter: number
    reason: string | null
    transferId: string | null
    orderId: string | null
    warehouse: { id: string; name: string }
    product: { id: string; name: string }
    /** Who did it; null for a change made by the system (a seed, an order) */
    by: { id: string; name: string } | null
}

export async function listMovements(shopId: string, q: MovementQuery): Promise<{ items: MovementRow[]; total: number; page: number; pageSize: number; pageCount: number }> {
    const where: Prisma.StockMovementWhereInput = {
        shopId,
        ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
        ...(q.productId ? { productId: q.productId } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
    }
    const total = await prisma.stockMovement.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / q.pageSize))
    const page = Math.min(q.page, pageCount)
    const rows = await prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * q.pageSize,
        take: q.pageSize,
        include: { warehouse: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
    })
    const userIds = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))]
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : []
    const who = new Map(users.map((u) => [u.id, u]))
    return {
        items: rows.map((r) => {
            const u = r.createdById ? who.get(r.createdById) : undefined
            return {
                id: r.id,
                createdAt: r.createdAt.toISOString(),
                type: r.type,
                quantity: r.quantity,
                balanceAfter: r.balanceAfter,
                reason: r.reason,
                transferId: r.transferId,
                orderId: r.orderId,
                warehouse: r.warehouse,
                product: r.product,
                by: u ? { id: u.id, name: u.name ?? u.email } : null,
            }
        }),
        total,
        page,
        pageSize: q.pageSize,
        pageCount,
    }
}
