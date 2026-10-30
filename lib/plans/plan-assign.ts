// lib/plans/plan-assign.ts
// Setting a business's plan by hand (`npm run db:set-plan`), until a payment method exists. The arguments
// and the dates are worked out here (pure, unit tested); scripts/set-plan.ts does the database part.
//
//   npm run db:set-plan -- <business public id> <PLAN KEY> [--trial-days 14] [--months 12] [--note "paid by bank transfer"]
//   npm run db:set-plan -- <business public id> FREE        puts the business back on the free plan

export type AssignArgs = { businessPublicId: string; planKey: string; trialDays: number | null; months: number | null; note: string | null }

export function parseAssignArgs(argv: readonly string[]): { ok: true; value: AssignArgs } | { ok: false; error: string } {
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
    if (positional.length !== 2) return { ok: false, error: "Give the business public id and the plan key, for example: db:set-plan -- <business id> PRO" }
    for (const f of flags.keys()) {
        if (!["--trial-days", "--months", "--note"].includes(f)) return { ok: false, error: `Unknown option ${f}` }
    }
    const whole = (name: string, max: number) => {
        const raw = flags.get(name)
        if (raw === undefined) return { ok: true as const, value: null }
        const n = Number(raw)
        return Number.isInteger(n) && n >= 1 && n <= max ? { ok: true as const, value: n } : { ok: false as const, error: `${name} must be a whole number from 1 to ${max}` }
    }
    const trial = whole("--trial-days", 365)
    if (!trial.ok) return trial
    const months = whole("--months", 60)
    if (!months.ok) return months
    if (trial.value !== null && months.value !== null) return { ok: false, error: "Use either --trial-days or --months, not both" }
    const note = flags.get("--note")?.trim() || null
    return { ok: true, value: { businessPublicId: positional[0], planKey: positional[1].toUpperCase(), trialDays: trial.value, months: months.value, note } }
}

const addMonths = (d: Date, n: number) => {
    const out = new Date(d.getTime())
    out.setUTCMonth(out.getUTCMonth() + n)
    return out
}

export type SubscriptionDates = {
    status: "TRIALING" | "ACTIVE"
    trialEndsAt: Date | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
}

/** A trial runs for N days; otherwise the subscription is active, for N months or until someone changes it. */
export function subscriptionDates(args: Pick<AssignArgs, "trialDays" | "months">, now: Date): SubscriptionDates {
    if (args.trialDays !== null) {
        return { status: "TRIALING", trialEndsAt: new Date(now.getTime() + args.trialDays * 24 * 60 * 60 * 1000), currentPeriodStart: null, currentPeriodEnd: null }
    }
    return { status: "ACTIVE", trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: args.months !== null ? addMonths(now, args.months) : null }
}
