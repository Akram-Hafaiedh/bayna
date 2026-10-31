// lib/inventory/stock-actions.ts
// The database side of stock. Every function takes the transaction from withAudit, so the change, the
// ledger row and the product total commit together (or not at all). The rules are in stock-rules.ts.
//
//   await withAudit(guard.actor, (tx) => adjustStock(tx, { shopId, productId, warehouseId, delta: -3, reason: "Damaged" }))
//
// Product.stock is the total of the product's StockLevel rows. Nothing else may write it.
import { randomUUID } from "node:crypto"
import type { Tx } from "@/lib/audit/run"
import {
    checkArchive, checkDelete, checkMakeDefault, checkTransfer, planMovement,
    type ManualType, type MovementType,
} from "@/lib/inventory/stock-rules"
import type { WarehouseData } from "@/lib/inventory/warehouse-input"

/** A refusal the person can fix. The API turns it into a response with this status. */
export class StockError extends Error {
    status: number
    constructor(message: string, status = 409) {
        super(message)
        this.name = "StockError"
        this.status = status
    }
}

type MovementInput = {
    shopId: string
    productId: string
    warehouseId: string
    type: MovementType
    /** See planMovement: a positive amount, a signed change (ADJUSTED) or a counted quantity (COUNTED) */
    amount: number
    reason?: string | null
    transferId?: string | null
    orderId?: string | null
}

export type MovementResult = { movementId: string; delta: number; after: number }

/** Serialises everything that touches one shop's warehouses (so two requests cannot both make a default). */
async function lockShop(tx: Tx, shopId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`
}

async function lockLevel(tx: Tx, productId: string, warehouseId: string): Promise<{ id: string; quantity: number }> {
    await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: { productId, warehouseId, quantity: 0 },
        update: {},
    })
    const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
        SELECT id, quantity FROM "StockLevel" WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`
    return rows[0]
}

async function syncProductTotal(tx: Tx, productId: string): Promise<number> {
    const sum = await tx.stockLevel.aggregate({ where: { productId }, _sum: { quantity: true } })
    const total = sum._sum.quantity ?? 0
    await tx.product.update({ where: { id: productId }, data: { stock: total } })
    return total
}

/** The shop's default warehouse, made from the shop's address and pin when it has none yet. */
export async function ensureDefaultWarehouse(tx: Tx, shopId: string): Promise<{ id: string }> {
    await lockShop(tx, shopId)
    const current = await tx.warehouse.findFirst({ where: { shopId, isDefault: true, archivedAt: null }, select: { id: true } })
    if (current) return current
    // A shop whose default was archived or removed: promote its oldest live warehouse
    const oldest = await tx.warehouse.findFirst({ where: { shopId, archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } })
    if (oldest) {
        await tx.warehouse.update({ where: { id: oldest.id }, data: { isDefault: true } })
        return oldest
    }
    const shop = await tx.shop.findUnique({
        where: { id: shopId },
        select: { address: true, city: true, governorate: true, latitude: true, longitude: true, locationSource: true },
    })
    if (!shop) throw new StockError("Shop not found", 404)
    return tx.warehouse.create({
        data: { shopId, name: "Main warehouse", isDefault: true, ...shop },
        select: { id: true },
    })
}

/** One movement: locks the level, applies the rule, writes the level, the ledger row and the product total. */
export async function applyMovement(tx: Tx, m: MovementInput): Promise<MovementResult> {
    const warehouse = await tx.warehouse.findFirst({ where: { id: m.warehouseId, shopId: m.shopId }, select: { id: true, archivedAt: true } })
    if (!warehouse) throw new StockError("Warehouse not found", 404)
    if (warehouse.archivedAt) throw new StockError("This warehouse is archived. Restore it to change its stock.")
    const product = await tx.product.findFirst({ where: { id: m.productId, shopId: m.shopId, deletedAt: null }, select: { id: true } })
    if (!product) throw new StockError("Product not found", 404)

    const level = await lockLevel(tx, m.productId, m.warehouseId)
    const plan = planMovement(m.type, level.quantity, m.amount)
    if (!plan.ok) throw new StockError(plan.error)

    await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: plan.value.after } })
    const row = await tx.stockMovement.create({
        data: {
            shopId: m.shopId,
            warehouseId: m.warehouseId,
            productId: m.productId,
            type: m.type,
            quantity: plan.value.delta,
            balanceAfter: plan.value.after,
            reason: m.reason ?? null,
            transferId: m.transferId ?? null,
            orderId: m.orderId ?? null,
        },
        select: { id: true },
    })
    await syncProductTotal(tx, m.productId)
    return { movementId: row.id, delta: plan.value.delta, after: plan.value.after }
}

/** Stock came in: a delivery, or opening stock. */
export const receiveStock = (tx: Tx, a: { shopId: string; productId: string; warehouseId: string; quantity: number; reason?: string | null }) =>
    applyMovement(tx, { ...a, type: "RECEIVED", amount: a.quantity })

/** A manual correction: `delta` is plus or minus. */
export const adjustStock = (tx: Tx, a: { shopId: string; productId: string; warehouseId: string; delta: number; reason?: string | null }) =>
    applyMovement(tx, { ...a, type: "ADJUSTED", amount: a.delta })

/** A stocktake: the quantity counted on the shelf; the ledger records the difference. */
export const countStock = (tx: Tx, a: { shopId: string; productId: string; warehouseId: string; counted: number; reason?: string | null }) =>
    applyMovement(tx, { ...a, type: "COUNTED", amount: a.counted })

/** Run one of the three manual kinds from a request. */
export function manualMovement(tx: Tx, type: ManualType, a: { shopId: string; productId: string; warehouseId: string; amount: number; reason?: string | null }) {
    return applyMovement(tx, { ...a, type })
}

/** Move stock between two warehouses of one shop: two ledger rows that share a transfer id. */
export async function transferStock(
    tx: Tx,
    a: { shopId: string; productId: string; fromId: string; toId: string; quantity: number; reason?: string | null }
): Promise<{ transferId: string; from: MovementResult; to: MovementResult }> {
    const [from, to] = await Promise.all([
        tx.warehouse.findFirst({ where: { id: a.fromId, shopId: a.shopId }, select: { id: true, shopId: true, archivedAt: true } }),
        tx.warehouse.findFirst({ where: { id: a.toId, shopId: a.shopId }, select: { id: true, shopId: true, archivedAt: true } }),
    ])
    if (!from || !to) throw new StockError("Warehouse not found", 404)
    const check = checkTransfer({
        fromId: from.id, toId: to.id, fromShopId: from.shopId, toShopId: to.shopId,
        fromArchived: from.archivedAt !== null, toArchived: to.archivedAt !== null,
    })
    if (!check.ok) throw new StockError(check.error)

    // Lock both levels in a fixed order, so two opposite transfers cannot wait on each other
    for (const id of [from.id, to.id].sort()) await lockLevel(tx, a.productId, id)

    const transferId = randomUUID()
    const out = await applyMovement(tx, { shopId: a.shopId, productId: a.productId, warehouseId: from.id, type: "TRANSFER_OUT", amount: a.quantity, reason: a.reason, transferId })
    const inn = await applyMovement(tx, { shopId: a.shopId, productId: a.productId, warehouseId: to.id, type: "TRANSFER_IN", amount: a.quantity, reason: a.reason, transferId })
    return { transferId, from: out, to: inn }
}

/** Opening stock of a new product: goes into the default warehouse, as a RECEIVED row. */
export async function openingStock(tx: Tx, a: { shopId: string; productId: string; quantity: number }): Promise<void> {
    if (a.quantity <= 0) return
    const wh = await ensureDefaultWarehouse(tx, a.shopId)
    await receiveStock(tx, { shopId: a.shopId, productId: a.productId, warehouseId: wh.id, quantity: a.quantity, reason: "Opening stock" })
}

/**
 * "Set the stock of this product to N" from the product form or the table. Only meaningful when the shop
 * has one warehouse; with several, the person must say which one (the Inventory page does that).
 */
export async function setTotalStock(tx: Tx, a: { shopId: string; productId: string; target: number }): Promise<void> {
    const live = await tx.warehouse.findMany({ where: { shopId: a.shopId, archivedAt: null }, select: { id: true } })
    if (live.length > 1) {
        throw new StockError("This shop has several warehouses. Change the stock per warehouse from the Inventory page.")
    }
    const wh = live[0] ?? (await ensureDefaultWarehouse(tx, a.shopId))
    const level = await tx.stockLevel.findUnique({ where: { productId_warehouseId: { productId: a.productId, warehouseId: wh.id } }, select: { quantity: true } })
    if ((level?.quantity ?? 0) === a.target) return
    await countStock(tx, { shopId: a.shopId, productId: a.productId, warehouseId: wh.id, counted: a.target, reason: "Stock edited on the product" })
}

export async function setReorderPoint(tx: Tx, a: { shopId: string; productId: string; warehouseId: string; reorderPoint: number | null }): Promise<void> {
    const wh = await tx.warehouse.findFirst({ where: { id: a.warehouseId, shopId: a.shopId }, select: { id: true } })
    if (!wh) throw new StockError("Warehouse not found", 404)
    const product = await tx.product.findFirst({ where: { id: a.productId, shopId: a.shopId, deletedAt: null }, select: { id: true } })
    if (!product) throw new StockError("Product not found", 404)
    await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId: a.productId, warehouseId: a.warehouseId } },
        create: { productId: a.productId, warehouseId: a.warehouseId, quantity: 0, reorderPoint: a.reorderPoint },
        update: { reorderPoint: a.reorderPoint },
    })
}

// ---- warehouses ------------------------------------------------------------------------------

export async function createWarehouse(tx: Tx, shopId: string, data: WarehouseData & { name: string; city: string }) {
    await ensureDefaultWarehouse(tx, shopId) // the first one is always the default
    return tx.warehouse.create({ data: { shopId, ...data, isDefault: false } })
}

async function ownWarehouse(tx: Tx, shopId: string, id: string) {
    const w = await tx.warehouse.findFirst({
        where: { id, shopId },
        select: { id: true, isDefault: true, archivedAt: true, _count: { select: { movements: true } } },
    })
    if (!w) throw new StockError("Warehouse not found", 404)
    return w
}

export async function makeDefaultWarehouse(tx: Tx, shopId: string, id: string): Promise<void> {
    await lockShop(tx, shopId)
    const w = await ownWarehouse(tx, shopId, id)
    const check = checkMakeDefault({ archived: w.archivedAt !== null, isDefault: w.isDefault })
    if (!check.ok) throw new StockError(check.error)
    await tx.warehouse.updateMany({ where: { shopId, isDefault: true }, data: { isDefault: false } })
    await tx.warehouse.update({ where: { id }, data: { isDefault: true } })
}

export async function archiveWarehouse(tx: Tx, shopId: string, id: string): Promise<void> {
    const w = await ownWarehouse(tx, shopId, id)
    const sum = await tx.stockLevel.aggregate({ where: { warehouseId: id }, _sum: { quantity: true } })
    const check = checkArchive({ isDefault: w.isDefault, archived: w.archivedAt !== null, stockTotal: sum._sum.quantity ?? 0 })
    if (!check.ok) throw new StockError(check.error)
    await tx.warehouse.update({ where: { id }, data: { archivedAt: new Date() } })
}

export async function restoreWarehouse(tx: Tx, shopId: string, id: string): Promise<void> {
    const w = await ownWarehouse(tx, shopId, id)
    if (w.archivedAt === null) throw new StockError("This warehouse is not archived")
    await tx.warehouse.update({ where: { id }, data: { archivedAt: null } })
}

export async function deleteWarehouse(tx: Tx, shopId: string, id: string): Promise<void> {
    const w = await ownWarehouse(tx, shopId, id)
    const check = checkDelete({ isDefault: w.isDefault, movementCount: w._count.movements })
    if (!check.ok) throw new StockError(check.error)
    await tx.warehouse.delete({ where: { id } })
}
