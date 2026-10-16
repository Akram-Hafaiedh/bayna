// lib/product-input.ts
// Validation of product fields coming from API request bodies.
import { Unit } from "@/app/generated/prisma/enums"
import { fail, isBlank, ok, parseText, type Parsed } from "@/lib/parse"

// Other files import these from here; they now live in lib/parse.ts.
export { parseText }
export type { Parsed }

/** Price in TND, stored as Decimal(12,3). Returned as a fixed 3-decimal string. */
export function parsePrice(v: unknown): Parsed<string> {
    if (isBlank(v) || (typeof v !== "number" && typeof v !== "string")) {
        return fail("Valid price is required")
    }
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 999_999_999) {
        return fail("Valid price is required")
    }
    return ok(n.toFixed(3))
}

/** Whole, non-negative number that fits a Postgres Int. */
export function parseStock(v: unknown): Parsed<number> {
    if (isBlank(v)) return ok(0)
    if (typeof v !== "number" && typeof v !== "string") {
        return fail("Stock must be a non-negative whole number")
    }
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > 2_000_000_000) {
        return fail("Stock must be a non-negative whole number")
    }
    return ok(n)
}

/** Empty means "no minimum" (null). Otherwise a whole number >= 1. */
export function parseMinOrderQty(v: unknown): Parsed<number | null> {
    if (isBlank(v)) return ok(null)
    if (typeof v !== "number" && typeof v !== "string") {
        return fail("Minimum order must be a whole number of at least 1")
    }
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) {
        return fail("Minimum order must be a whole number of at least 1")
    }
    return ok(n)
}

export function parseUnit(v: unknown): Parsed<Unit> {
    if (typeof v === "string" && (Object.values(Unit) as string[]).includes(v)) {
        return ok(v as Unit)
    }
    return fail("Invalid unit")
}
