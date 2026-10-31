// lib/inventory/stock-rules.ts
// The rules of stock, with no database: how a movement changes a quantity, what a transfer needs, and
// when a warehouse may be deleted, archived or made the default. Pure (unit tested); the database side
// is lib/inventory/stock-actions.ts.
import { fail, ok, type Parsed } from "@/lib/shared/parse"

export const MOVEMENT_TYPES = ["RECEIVED", "SOLD", "ADJUSTED", "RETURNED", "COUNTED", "TRANSFER_IN", "TRANSFER_OUT"] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

/**
 * What a shop may do by hand. RETURNED can be recorded by hand too (an order return that went wrong, a
 * walk-in return); when orders exist they write the same type with the order attached. SOLD belongs to
 * orders and TRANSFER_* to the transfer action.
 */
export const MANUAL_TYPES = ["RECEIVED", "RETURNED", "ADJUSTED", "COUNTED"] as const
export type ManualType = (typeof MANUAL_TYPES)[number]

export const MOVEMENT_LABEL: Record<MovementType, string> = {
    RECEIVED: "Received",
    SOLD: "Sold",
    ADJUSTED: "Adjusted",
    RETURNED: "Returned",
    COUNTED: "Counted",
    TRANSFER_IN: "Transferred in",
    TRANSFER_OUT: "Transferred out",
}

export const isMovementType = (v: unknown): v is MovementType => typeof v === "string" && (MOVEMENT_TYPES as readonly string[]).includes(v)
export const isManualType = (v: unknown): v is ManualType => typeof v === "string" && (MANUAL_TYPES as readonly string[]).includes(v)

/** Largest quantity accepted in one go (fits a Postgres Int with room to add). */
export const MAX_QUANTITY = 1_000_000_000

/** A whole number from 1 to MAX_QUANTITY. */
export function parseQuantity(v: unknown, label = "Quantity"): Parsed<number> {
    if (typeof v !== "number" && typeof v !== "string") return fail(`${label} must be a whole number of at least 1`)
    if (typeof v === "string" && v.trim() === "") return fail(`${label} must be a whole number of at least 1`)
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) return fail(`${label} must be a whole number of at least 1`)
    return ok(n)
}

/** A whole number from 0 to MAX_QUANTITY (a counted quantity or a stock level can be zero). */
export function parseCount(v: unknown, label = "Quantity"): Parsed<number> {
    if (typeof v !== "number" && typeof v !== "string") return fail(`${label} must be a whole number, 0 or more`)
    if (typeof v === "string" && v.trim() === "") return fail(`${label} must be a whole number, 0 or more`)
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > MAX_QUANTITY) return fail(`${label} must be a whole number, 0 or more`)
    return ok(n)
}

/** A non-zero whole number, plus or minus (a manual adjustment). */
export function parseDelta(v: unknown, label = "Change"): Parsed<number> {
    if (typeof v !== "number" && typeof v !== "string") return fail(`${label} must be a whole number, not 0`)
    if (typeof v === "string" && v.trim() === "") return fail(`${label} must be a whole number, not 0`)
    const n = Number(v)
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > MAX_QUANTITY) return fail(`${label} must be a whole number, not 0`)
    return ok(n)
}

/** The optional reason: trimmed, at most 200 characters, empty means none. */
export function parseReason(v: unknown): Parsed<string | null> {
    if (v === undefined || v === null) return ok(null)
    if (typeof v !== "string") return fail("The reason must be text")
    const t = v.trim()
    if (t.length > 200) return fail("The reason is too long (max 200 characters)")
    return ok(t || null)
}

export type MovementPlan = { delta: number; after: number }

/**
 * What a movement does to a warehouse that holds `current`:
 *   RECEIVED, RETURNED, TRANSFER_IN   add `amount` (positive)
 *   SOLD, TRANSFER_OUT                take `amount` (positive) out
 *   ADJUSTED                          `amount` is the signed change
 *   COUNTED                           `amount` is the counted quantity; the change is the difference
 * Refuses a change that would leave less than zero, or one that changes nothing.
 */
export function planMovement(type: MovementType, current: number, amount: number): Parsed<MovementPlan> {
    let delta: number
    switch (type) {
        case "RECEIVED":
        case "RETURNED":
        case "TRANSFER_IN":
            if (!Number.isInteger(amount) || amount < 1) return fail("The quantity must be at least 1")
            delta = amount
            break
        case "SOLD":
        case "TRANSFER_OUT":
            if (!Number.isInteger(amount) || amount < 1) return fail("The quantity must be at least 1")
            delta = -amount
            break
        case "ADJUSTED":
            if (!Number.isInteger(amount) || amount === 0) return fail("The change cannot be 0")
            delta = amount
            break
        case "COUNTED":
            if (!Number.isInteger(amount) || amount < 0) return fail("The counted quantity must be 0 or more")
            delta = amount - current
            if (delta === 0) return fail("The count matches the stock already recorded, so nothing changed")
            break
    }
    const after = current + delta
    if (after < 0) return fail(`Not enough stock: this warehouse holds ${current}`)
    if (after > MAX_QUANTITY) return fail("That quantity is too large")
    return ok({ delta, after })
}

/** A transfer moves stock between two different warehouses of the same shop. */
export function checkTransfer(input: { fromId: string; toId: string; fromShopId: string; toShopId: string; fromArchived: boolean; toArchived: boolean }): Parsed<true> {
    if (input.fromId === input.toId) return fail("Choose two different warehouses")
    if (input.fromShopId !== input.toShopId) return fail("Warehouse not found")
    if (input.toArchived) return fail("An archived warehouse takes no new stock")
    if (input.fromArchived) return fail("An archived warehouse has no stock to move")
    return ok(true)
}

export type StockState = "out" | "low" | "ok"

/** Out at 0; low at or below the reorder point (when one is set); otherwise fine. */
export function stockState(quantity: number, reorderPoint: number | null): StockState {
    if (quantity <= 0) return "out"
    if (reorderPoint !== null && quantity <= reorderPoint) return "low"
    return "ok"
}

// ---- warehouses ------------------------------------------------------------------------------

/** A warehouse made by mistake can be deleted; one with any history can only be archived. */
export function checkDelete(w: { isDefault: boolean; movementCount: number }): Parsed<true> {
    if (w.isDefault) return fail("Make another warehouse the default first")
    if (w.movementCount > 0) return fail("This warehouse has stock history, so it cannot be deleted. Archive it instead (its stock must be 0).")
    return ok(true)
}

/** Archive: not the default, not already archived, and empty. */
export function checkArchive(w: { isDefault: boolean; archived: boolean; stockTotal: number }): Parsed<true> {
    if (w.archived) return fail("This warehouse is already archived")
    if (w.isDefault) return fail("Make another warehouse the default first")
    if (w.stockTotal > 0) return fail(`Move its ${w.stockTotal} item${w.stockTotal === 1 ? "" : "s"} of stock to another warehouse first`)
    return ok(true)
}

/** Only a live warehouse can become the default. */
export function checkMakeDefault(w: { archived: boolean; isDefault: boolean }): Parsed<true> {
    if (w.archived) return fail("Restore this warehouse before making it the default")
    if (w.isDefault) return fail("It is already the default")
    return ok(true)
}
