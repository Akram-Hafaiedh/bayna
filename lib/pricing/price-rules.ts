// lib/pricing/price-rules.ts
// The arithmetic of prices and taxes, with no database. This is the ONLY place that adds a tax to a price.
//
// The shop enters the price before tax (HT). It chooses which of its taxes a product carries. A buyer sees the
// price with tax (TTC). Taxes apply in the shop's order; each one is a percentage or a fixed amount per unit,
// and says whether it applies on the base price or on the base plus the taxes before it. The dinar has three
// decimals (millimes): every tax line is rounded half up to the millime, and the TTC is the sum of the
// rounded lines, so the lines always add up to the total.
//
// All amounts are handled as whole millimes (BigInt), never as floating point numbers.
import { fail, ok, type Parsed } from "@/lib/shared/parse"

export const TAX_KINDS = ["PERCENTAGE", "FIXED"] as const
export type TaxKindValue = (typeof TAX_KINDS)[number]
export const TAX_APPLIES_ON = ["BASE", "RUNNING"] as const
export type TaxAppliesOnValue = (typeof TAX_APPLIES_ON)[number]

export const isTaxKind = (v: unknown): v is TaxKindValue => typeof v === "string" && (TAX_KINDS as readonly string[]).includes(v)
export const isTaxAppliesOn = (v: unknown): v is TaxAppliesOnValue => typeof v === "string" && (TAX_APPLIES_ON as readonly string[]).includes(v)

export const TAX_LABEL = { PERCENTAGE: "Percentage", FIXED: "Fixed amount per unit" } as const
export const APPLIES_ON_LABEL = { BASE: "On the price before tax", RUNNING: "On the price plus the taxes before it" } as const

/** Largest price accepted: Decimal(12,3) holds up to 999 999 999.999 */
export const MAX_MILLIMES = BigInt(999999999999)

// ---- money as millimes ------------------------------------------------------------------------------

/** "12.5" or 12.5 -> 12500 millimes. Null when it is not a non-negative amount with at most 3 decimals. */
export function toMillimes(v: string | number): bigint | null {
    const s = typeof v === "number" ? (Number.isFinite(v) ? v.toString() : "") : v.trim()
    const m = /^(\d{1,9})(?:\.(\d{1,3}))?$/.exec(s)
    if (!m) return null
    return BigInt(m[1]) * BigInt(1000) + BigInt((m[2] ?? "").padEnd(3, "0") || "0")
}

/** 120690 millimes -> "120.690" (the form the database and the API use). */
export function fromMillimes(m: bigint): string {
    const neg = m < BigInt(0)
    const a = neg ? -m : m
    return `${neg ? "-" : ""}${a / BigInt(1000)}.${(a % BigInt(1000)).toString().padStart(3, "0")}`
}

/** A tax value with up to 4 decimals as ten-thousandths: "19" -> 190000, "0.5" -> 5000. */
function toTenThousandths(v: string | number): bigint | null {
    const s = typeof v === "number" ? (Number.isFinite(v) ? v.toString() : "") : v.trim()
    const m = /^(\d{1,8})(?:\.(\d{1,4}))?$/.exec(s)
    if (!m) return null
    return BigInt(m[1]) * BigInt(10000) + BigInt((m[2] ?? "").padEnd(4, "0") || "0")
}

// ---- the calculation ------------------------------------------------------------------------------

export type TaxInput = {
    id: string
    name: string
    kind: TaxKindValue
    /** Percentage (for example "19") or amount in TND (for example "0.500") */
    value: string | number
    appliesOn: TaxAppliesOnValue
}

export type PriceLine = { taxId: string; name: string; kind: TaxKindValue; appliesOn: TaxAppliesOnValue; value: string; amount: string }
export type PriceResult = { base: string; lines: PriceLine[]; taxTotal: string; total: string }

/** Round half up: numerator / denominator, both positive. */
const divRound = (n: bigint, d: bigint) => (n + d / BigInt(2)) / d

/**
 * The price with tax. `taxes` must already be in the order they apply (the shop's sort order) and contain only
 * the taxes that count (active ones). A tax with an unreadable value is a programming error, not a price.
 *   base 100.000, 1% on the base, 19% on the running total, 0.500 fixed
 *   -> 1.000, 19.190, 0.500 -> total 120.690
 */
export function computePrice(base: string | number, taxes: readonly TaxInput[]): PriceResult {
    const baseM = toMillimes(base)
    if (baseM === null) throw new Error(`computePrice: bad base price ${String(base)}`)
    let running = baseM
    let taxTotal = BigInt(0)
    const lines: PriceLine[] = []
    for (const t of taxes) {
        let amount: bigint
        if (t.kind === "FIXED") {
            const m = toMillimes(t.value)
            if (m === null) throw new Error(`computePrice: bad fixed amount ${String(t.value)} for ${t.name}`)
            amount = m
        } else {
            const p = toTenThousandths(t.value)
            if (p === null) throw new Error(`computePrice: bad percentage ${String(t.value)} for ${t.name}`)
            const on = t.appliesOn === "RUNNING" ? running : baseM
            amount = divRound(on * p, BigInt(1000000)) // percent of millimes, p is in ten-thousandths of a percent
        }
        running += amount
        taxTotal += amount
        lines.push({ taxId: t.id, name: t.name, kind: t.kind, appliesOn: t.appliesOn, value: String(t.value), amount: fromMillimes(amount) })
    }
    return { base: fromMillimes(baseM), lines, taxTotal: fromMillimes(taxTotal), total: fromMillimes(baseM + taxTotal) }
}

/** What a product's price needs from the shop: taxes chosen, marked exempt, or neither (to set). */
export type TaxState = "TAXED" | "EXEMPT" | "UNSET"

export function taxState(p: { taxExempt: boolean; activeTaxCount: number }): TaxState {
    if (p.taxExempt) return "EXEMPT"
    return p.activeTaxCount > 0 ? "TAXED" : "UNSET"
}

export const TAX_STATE_LABEL: Record<TaxState, string> = { TAXED: "Taxed", EXEMPT: "Tax exempt", UNSET: "Tax to set" }

// ---- the taxes of a product from a request body ----------------------------------------------------

export type TaxChoice = { taxIds?: string[]; taxExempt?: boolean }

/** `taxIds` (a list of tax ids) and `taxExempt` (true or false) from a product request; both optional. */
export function parseTaxChoice(body: unknown): Parsed<TaxChoice> {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>
    const out: TaxChoice = {}
    if (b.taxIds !== undefined) {
        if (!Array.isArray(b.taxIds) || b.taxIds.some((x) => typeof x !== "string" || x === "")) return fail("The taxes must be a list of tax ids")
        if (b.taxIds.length > 20) return fail("A product cannot carry more than 20 taxes")
        out.taxIds = [...new Set(b.taxIds as string[])]
    }
    if (b.taxExempt !== undefined) {
        if (typeof b.taxExempt !== "boolean") return fail("taxExempt must be true or false")
        out.taxExempt = b.taxExempt
    }
    if (out.taxExempt === true && out.taxIds && out.taxIds.length > 0) return fail("A tax-exempt product cannot carry taxes")
    return ok(out)
}

// ---- a tax from a request body ------------------------------------------------------------------------

export type TaxData = { name?: string; kind?: TaxKindValue; value?: string; appliesOn?: TaxAppliesOnValue; isActive?: boolean }

export type TaxSnapshot = { kind: TaxKindValue; value: string }

/**
 * Validates a tax coming from an API request. One parser serves creating (`current` null) and editing.
 * Name 2..60; a percentage is above 0 and at most 100 with up to 4 decimals; a fixed amount is above 0 with up to
 * 3 decimals (millimes). A fixed amount has no "applies on" (it is per unit), so it is always stored as BASE.
 */
export function parseTaxFields(body: unknown, current: TaxSnapshot | null): Parsed<TaxData> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Invalid request")
    const b = body as Record<string, unknown>
    const creating = current === null
    const data: TaxData = {}

    if (creating || b.name !== undefined) {
        if (typeof b.name !== "string") return fail("Tax name is required")
        const name = b.name.trim()
        if (name.length < 2) return fail("Tax name is too short (min 2 characters)")
        if (name.length > 60) return fail("Tax name is too long (max 60 characters)")
        data.name = name
    }
    if (creating || b.kind !== undefined) {
        if (!isTaxKind(b.kind)) return fail("Choose a percentage or a fixed amount")
        data.kind = b.kind
    }
    if (b.appliesOn !== undefined) {
        if (!isTaxAppliesOn(b.appliesOn)) return fail("Choose where the tax applies: on the price before tax or on the running total")
        data.appliesOn = b.appliesOn
    }
    if (b.isActive !== undefined) {
        if (typeof b.isActive !== "boolean") return fail("isActive must be true or false")
        data.isActive = b.isActive
    }

    const kind = data.kind ?? current?.kind
    if (creating || b.value !== undefined || data.kind !== undefined) {
        const raw = b.value !== undefined ? b.value : current?.value
        if (typeof raw !== "string" && typeof raw !== "number") return fail("Enter the value of the tax")
        const text = typeof raw === "number" ? String(raw) : raw.trim()
        if (kind === "PERCENTAGE") {
            const p = toTenThousandths(text)
            if (p === null) return fail("A percentage is a number with at most 4 decimals")
            if (p <= BigInt(0) || p > BigInt(1000000)) return fail("A percentage must be above 0 and at most 100")
        } else {
            const m = toMillimes(text)
            if (m === null) return fail("A fixed amount is in TND with at most 3 decimals")
            if (m <= BigInt(0)) return fail("A fixed amount must be above 0")
            if (m > MAX_MILLIMES) return fail("That amount is too large")
        }
        data.value = text
    }
    if (kind === "FIXED") data.appliesOn = "BASE"
    return ok(data)
}
