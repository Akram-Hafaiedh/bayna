// lib/pricing/price-history-rules.ts
// What a price history row means and how two prices compare, with no database (unit tested).
// The rows are written by lib/pricing/price-history.ts.
import { toMillimes, fromMillimes } from "@/lib/pricing/price-rules"

export const PRICE_REASONS = ["INITIAL", "PRICE", "TAX"] as const
export type PriceReason = (typeof PRICE_REASONS)[number]
export const isPriceReason = (v: unknown): v is PriceReason => typeof v === "string" && (PRICE_REASONS as readonly string[]).includes(v)

export const PRICE_REASON_LABEL: Record<PriceReason, string> = {
    INITIAL: "First price",
    PRICE: "Price changed",
    TAX: "Taxes changed",
}

export type PriceChange = { direction: "up" | "down" | "same" | "first"; /** Absolute difference in TND ("0.000" when none) */ amount: string }

/** How `next` differs from `previous` (both TND amounts as text). No previous price means the first one. */
export function priceChange(previous: string | null, next: string): PriceChange {
    const b = toMillimes(next)
    if (b === null) throw new Error(`Not an amount: ${next}`)
    if (previous === null) return { direction: "first", amount: "0.000" }
    const a = toMillimes(previous)
    if (a === null) throw new Error(`Not an amount: ${previous}`)
    if (b === a) return { direction: "same", amount: "0.000" }
    return b > a ? { direction: "up", amount: fromMillimes(b - a) } : { direction: "down", amount: fromMillimes(a - b) }
}
