// lib/plans/plan-price.ts
// Changing a plan's prices (`npm run db:set-price`) until the admin area has a plans page. The arguments
// are checked here (pure, unit tested); scripts/set-price.ts does the database part. A price change only
// changes what is shown and charged from now on; it does not touch the plan's limits.
//
//   npm run db:set-price -- PRO --monthly 45 --yearly 450
//   npm run db:set-price -- PRO --yearly 420          change one price, keep the other
//   npm run db:set-price -- PRO --monthly none        take a price away ("price on request")
import { FREE_PLAN_KEY, yearlySaving } from "./plans"

export type PriceArgs = {
    planKey: string
    /** undefined = leave as it is, null = remove the price */
    monthly: number | null | undefined
    yearly: number | null | undefined
    warnings: string[]
}

const MAX_PRICE = 100000

function amount(name: string, raw: string | undefined): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
    if (raw === undefined) return { ok: true, value: undefined }
    if (raw.toLowerCase() === "none") return { ok: true, value: null }
    // Plain numbers only: 45, 45.5, 45.500 (the database keeps three decimals)
    if (!/^\d+(\.\d{1,3})?$/.test(raw)) return { ok: false, error: `${name} must be a number such as 45 or 45.5, or "none"` }
    const n = Number(raw)
    if (n > MAX_PRICE) return { ok: false, error: `${name} is too large` }
    return { ok: true, value: n }
}

export function parsePriceArgs(argv: readonly string[]): { ok: true; value: PriceArgs } | { ok: false; error: string } {
    const positional: string[] = []
    const flags = new Map<string, string>()
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a.startsWith("--")) {
            const v = argv[i + 1]
            if (v === undefined || v.startsWith("--")) return { ok: false, error: `${a} needs a value` }
            flags.set(a, v)
            i++
        } else positional.push(a)
    }
    if (positional.length !== 1) return { ok: false, error: "Give the plan key, for example: db:set-price -- PRO --monthly 45 --yearly 450" }
    for (const f of flags.keys()) if (f !== "--monthly" && f !== "--yearly") return { ok: false, error: `Unknown option ${f}` }
    if (flags.size === 0) return { ok: false, error: "Give --monthly, --yearly or both" }

    const planKey = positional[0].toUpperCase()
    if (planKey === FREE_PLAN_KEY) return { ok: false, error: "The free plan has no price" }

    const monthly = amount("--monthly", flags.get("--monthly"))
    if (!monthly.ok) return monthly
    const yearly = amount("--yearly", flags.get("--yearly"))
    if (!yearly.ok) return yearly
    return { ok: true, value: { planKey, monthly: monthly.value, yearly: yearly.value, warnings: [] } }
}

/** Notes about the prices as they will be after the change (never blocks the change). */
export function priceWarnings(monthly: number | null, yearly: number | null): string[] {
    const out: string[] = []
    if (monthly !== null && yearly !== null && yearly > 0 && monthly > 0 && !yearlySaving({ priceMonthly: monthly, priceYearly: yearly })) {
        out.push("The yearly price is not lower than twelve months, so no saving will be shown.")
    }
    if ((monthly === null) !== (yearly === null)) out.push("Only one of the two prices is set; the other is worked out from it, without a saving.")
    return out
}
