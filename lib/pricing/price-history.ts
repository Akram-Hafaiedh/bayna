// lib/pricing/price-history.ts
// The price history of a product: written in the same transaction as the change, read for the history view.
//
// recordPriceHistory adds a row for each product whose price before tax or price with tax is not what its
// latest row says (and the first row for a product with none). It is called by lib/pricing after every
// change it makes, so one change is one row: the price and the taxes of a product edited together are one row.
import { prisma } from "@/lib/prisma"
import type { Tx } from "@/lib/audit/run"
import { isPriceReason, priceChange, type PriceChange, type PriceReason } from "@/lib/pricing/price-history-rules"

/**
 * Record the products of a shop whose price moved (all of the shop's products when no ids are given).
 * Returns how many rows were added. The reason is worked out from the latest row: none = INITIAL, a different
 * price before tax = PRICE, otherwise only the price with tax moved = TAX.
 */
export async function recordPriceHistory(tx: Tx, shopId: string, productIds?: string[]): Promise<number> {
    if (productIds && productIds.length === 0) return 0
    const ids = productIds ?? null // null = every product of the shop
    // clock_timestamp, not now(): two changes in one transaction keep their order
    return tx.$executeRaw`
        INSERT INTO "PriceHistory" ("shopId", "productId", "price", "priceTtc", "reason", "createdAt")
        SELECT p."shopId", p."id", p."price", p."priceTtc",
               CASE WHEN l."id" IS NULL THEN 'INITIAL' WHEN l."price" <> p."price" THEN 'PRICE' ELSE 'TAX' END,
               timezone('UTC', clock_timestamp())
        FROM "Product" p
        LEFT JOIN LATERAL (
            SELECT h."id", h."price", h."priceTtc" FROM "PriceHistory" h
            WHERE h."productId" = p."id" ORDER BY h."createdAt" DESC, h."id" DESC LIMIT 1
        ) l ON true
        WHERE p."shopId" = ${shopId} AND (${ids}::text[] IS NULL OR p."id" = ANY(${ids}::text[]))
          AND (l."id" IS NULL OR l."price" <> p."price" OR l."priceTtc" <> p."priceTtc")`
}

export type PriceHistoryRow = {
    id: string
    at: string
    price: string
    priceTtc: string
    reason: PriceReason
    /** How the price before tax, and the price with tax, moved from the row before; "first" for the oldest row */
    change: PriceChange
    changeTtc: PriceChange
    /** The person who made the change, null when nobody is recorded (a seed, a script) */
    by: { id: string; name: string } | null
}

export const PRICE_HISTORY_LIMIT = 200

/** A product's history, newest first. Null when the product does not exist in this shop. */
export async function listPriceHistory(shopId: string, productId: string): Promise<{ product: { id: string; name: string; unit: string }; rows: PriceHistoryRow[]; total: number } | null> {
    const product = await prisma.product.findFirst({ where: { id: productId, shopId }, select: { id: true, name: true, unit: true } })
    if (!product) return null
    const [total, recent] = await Promise.all([
        prisma.priceHistory.count({ where: { productId } }),
        // one more than shown, so the oldest row shown can say how it moved
        prisma.priceHistory.findMany({ where: { productId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PRICE_HISTORY_LIMIT + 1 }),
    ])
    const people = [...new Set(recent.map((r) => r.createdById).filter((v): v is string => !!v))]
    const users = people.length ? await prisma.user.findMany({ where: { id: { in: people } }, select: { id: true, name: true, email: true } }) : []
    const names = new Map(users.map((u) => [u.id, u.name || u.email]))
    const rows: PriceHistoryRow[] = recent.slice(0, PRICE_HISTORY_LIMIT).map((r, i) => {
        const before = recent[i + 1]
        return {
            id: r.id,
            at: r.createdAt.toISOString(),
            price: r.price.toFixed(3),
            priceTtc: r.priceTtc.toFixed(3),
            reason: isPriceReason(r.reason) ? r.reason : "PRICE",
            change: priceChange(before ? before.price.toFixed(3) : null, r.price.toFixed(3)),
            changeTtc: priceChange(before ? before.priceTtc.toFixed(3) : null, r.priceTtc.toFixed(3)),
            by: r.createdById ? { id: r.createdById, name: names.get(r.createdById) ?? "Someone" } : null,
        }
    })
    return { product, rows, total }
}
