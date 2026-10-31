// lib/inventory/stock-reasons.ts
// Why stock was changed by hand. Each kind of change (and, for an adjustment, each direction) offers its own
// short list, so the history can say "damaged" or "customer return" and reports can count them. A note
// (free text) goes with it; "Other" cannot be left without one. Pure (unit tested).
import { fail, ok, type Parsed } from "@/lib/shared/parse"
import type { ManualType } from "@/lib/inventory/stock-rules"

export const REASON_LABEL = {
    // receiving
    SUPPLIER_DELIVERY: "Supplier delivery",
    PRODUCTION: "Production",
    // returns
    CUSTOMER_RETURN: "Customer return",
    // adjusting up
    FOUND: "Found",
    // adjusting down
    DAMAGED: "Damaged",
    LOST: "Lost or stolen",
    EXPIRED: "Expired",
    SAMPLE: "Sample or gift",
    INTERNAL_USE: "Internal use",
    // both directions
    CORRECTION: "Correction",
    // counting
    STOCKTAKE: "Stocktake",
    // always available
    OTHER: "Other",
    // written by the system, never chosen by a person
    OPENING_STOCK: "Opening stock",
    PRODUCT_EDIT: "Stock edited on the product",
} as const

export type ReasonCode = keyof typeof REASON_LABEL

export const REASON_CODES = Object.keys(REASON_LABEL) as ReasonCode[]
export const isReasonCode = (v: unknown): v is ReasonCode => typeof v === "string" && Object.prototype.hasOwnProperty.call(REASON_LABEL, v)

const RECEIVE: ReasonCode[] = ["SUPPLIER_DELIVERY", "PRODUCTION", "OTHER"]
const RETURN: ReasonCode[] = ["CUSTOMER_RETURN", "OTHER"]
const ADJUST_UP: ReasonCode[] = ["FOUND", "CORRECTION", "OTHER"]
const ADJUST_DOWN: ReasonCode[] = ["DAMAGED", "LOST", "EXPIRED", "SAMPLE", "INTERNAL_USE", "CORRECTION", "OTHER"]
const COUNT: ReasonCode[] = ["STOCKTAKE", "OTHER"]

/**
 * The reasons a person may pick. For an adjustment it depends on the sign of the change (`signed`); with no
 * change typed yet the list is empty.
 */
export function reasonOptions(type: ManualType, signed?: number | null): ReasonCode[] {
    switch (type) {
        case "RECEIVED": return RECEIVE
        case "RETURNED": return RETURN
        case "COUNTED": return COUNT
        case "ADJUSTED":
            if (!signed) return []
            return signed > 0 ? ADJUST_UP : ADJUST_DOWN
    }
}

/** The reason and note of a request: the reason must be one that fits, and "Other" needs a note. */
export function parseReasonChoice(type: ManualType, signed: number, code: unknown, note: string | null): Parsed<{ reasonCode: ReasonCode; reason: string | null }> {
    if (code === undefined || code === null || code === "") return fail("Choose a reason")
    if (!isReasonCode(code) || !reasonOptions(type, signed).includes(code)) return fail("That reason does not fit this change")
    if (code === "OTHER" && !note) return fail("Say what happened: a note is needed when the reason is Other")
    return ok({ reasonCode: code, reason: note })
}
