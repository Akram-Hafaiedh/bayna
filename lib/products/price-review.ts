// lib/products/price-review.ts
// Pure helpers for "the price of this product may be wrong now" (decision 7 of 16 Oct 2026).
// When the catalogue unit of an item changes, every product linked to it keeps its old price but sells
// a different thing (a price per piece is not a price per box), so it is flagged until the shop
// confirms the price.
import type { Unit } from "@/app/generated/prisma/enums"
import { UNIT_NAMES } from "@/lib/catalogue/units"

/** Short unit name for sentences: "Piece", "Bag", "Meter (m)". */
export function unitName(unit: Unit): string {
    return UNIT_NAMES[unit] ?? unit
}

/** Text stored on the product and shown to the shop. */
export function unitChangeReason(from: Unit, to: Unit): string {
    return `Unit changed from ${unitName(from)} to ${unitName(to)}`
}

export type FlagCounts = { products: number; shops: number }

/** Counts of distinct products and distinct shops, for the admin's "are you sure" preview. */
export function countAffected(rows: readonly { id: string; shopId: string }[]): FlagCounts {
    return {
        products: new Set(rows.map((r) => r.id)).size,
        shops: new Set(rows.map((r) => r.shopId)).size,
    }
}

/** "1 product in 1 shop", "14 products in 9 shops". */
export function describeCounts({ products, shops }: FlagCounts): string {
    const p = `${products} product${products === 1 ? "" : "s"}`
    const s = `${shops} shop${shops === 1 ? "" : "s"}`
    return `${p} in ${s}`
}

/**
 * What a price update does to the review flag.
 *   - a different price, or an explicit "keep this price", clears the flag and stamps the date
 *   - sending the same price again without confirming changes nothing (an edit form resends every field)
 */
export function priceEffect(args: {
    currentPrice: number
    nextPrice: number | undefined
    confirm: boolean
}): { stampDate: boolean; clearReview: boolean } {
    const changed = args.nextPrice !== undefined && args.nextPrice !== args.currentPrice
    return { stampDate: changed || args.confirm, clearReview: changed || args.confirm }
}
