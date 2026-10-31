// lib/plans/plans.ts
// Plans and limits: what a business gets and where it stops. Pure (unit tested); the database side is
// lib/plans/plan-limits.ts. Decision 4 of 16 Oct 2026: a free plan with limits, paid plans that raise them.
//
//   - The plan belongs to the BUSINESS. Limits count across all of its shops.
//   - A business with no subscription is on FREE.
//   - The numbers below are placeholders to tune; so are the prices. Both live in the database once seeded
//     and are changed there (`npm run db:set-price`), never by editing this file after the first seed.
//   - Limits only block anything when PLAN_LIMITS=on (see limitsEnforced). Until then they are shown, not applied.
//   - A null limit means "no limit". A limit missing from a plan row falls back to the default of that
//     built-in plan (so a new row below needs no database change), and to "no limit" for any other plan.
//   - Security and safety (2FA, the audit log, notifications) are never limited.

export const LIMIT_KEYS = ["shops", "products", "teamSeats", "customRoles", "warehouses", "customTaxes"] as const
export type LimitKey = (typeof LIMIT_KEYS)[number]

export const LIMIT_LABEL: Record<LimitKey, { one: string; many: string }> = {
    shops: { one: "shop", many: "shops" },
    products: { one: "product", many: "products" },
    teamSeats: { one: "team member", many: "team members" },
    customRoles: { one: "custom role", many: "custom roles" },
    warehouses: { one: "warehouse", many: "warehouses" },
    customTaxes: { one: "custom tax", many: "custom taxes" },
}

export type Limits = Partial<Record<LimitKey, number | null>>

export const FEATURE_KEYS = [
    "advancedReports", "lowStockAlerts", "invoicing", "bulkImport", "apiAccess", "priorityPlacement", "prioritySupport",
] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURE_LABEL: Record<FeatureKey, string> = {
    advancedReports: "Advanced reports and exports",
    lowStockAlerts: "Low-stock alerts",
    invoicing: "Invoices and tax reports",
    bulkImport: "Bulk import (CSV)",
    apiAccess: "API access",
    priorityPlacement: "Priority placement in results",
    prioritySupport: "Priority support",
}

export type Features = Partial<Record<FeatureKey, boolean>>

export const CURRENCY = "TND"

export type BillingPeriod = "monthly" | "yearly"

export type PlanDefinition = {
    key: string
    name: string
    description: string
    /** TND per month; null = free or not decided yet */
    priceMonthly: number | null
    /** TND per year, a small discount on twelve months; null = free or not decided yet */
    priceYearly: number | null
    limits: Limits
    features: Features
    sortOrder: number
}

export const FREE_PLAN_KEY = "FREE"

/** The starting plans (placeholders to tune). `npm run seed plans` copies them into the database. */
export const DEFAULT_PLANS: readonly PlanDefinition[] = [
    {
        key: "FREE",
        name: "Free",
        description: "For a business that is starting out.",
        priceMonthly: null,
        priceYearly: null,
        limits: { shops: 1, products: 50, teamSeats: 1, customRoles: 1, warehouses: 1, customTaxes: 3 },
        features: {},
        sortOrder: 0,
    },
    {
        key: "PRO",
        name: "Pro",
        description: "More room for a growing business, with full reports.",
        priceMonthly: 40,
        priceYearly: 400, // two months free
        limits: { shops: 3, products: 500, teamSeats: 3, customRoles: 5, warehouses: 3, customTaxes: 10 },
        features: { advancedReports: true, lowStockAlerts: true, invoicing: true },
        sortOrder: 1,
    },
    {
        key: "BUSINESS",
        name: "Business",
        description: "For several outlets and a bigger team.",
        priceMonthly: 100,
        priceYearly: 1000, // two months free
        limits: { shops: 10, products: null, teamSeats: 10, customRoles: null, warehouses: 10, customTaxes: null },
        features: {
            advancedReports: true, lowStockAlerts: true, invoicing: true, bulkImport: true, apiAccess: true,
            priorityPlacement: true, prioritySupport: true,
        },
        sortOrder: 2,
    },
]

export const defaultPlan = (key: string): PlanDefinition | undefined => DEFAULT_PLANS.find((p) => p.key === key)

/** Limits read from the database (Json): known keys only, whole numbers of 0 or more, or null. */
export function parseLimits(raw: unknown): Limits {
    const out: Limits = {}
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
    for (const key of LIMIT_KEYS) {
        const v = (raw as Record<string, unknown>)[key]
        if (v === null) out[key] = null
        else if (typeof v === "number" && Number.isInteger(v) && v >= 0) out[key] = v
    }
    return out
}

export function parseFeatures(raw: unknown): Features {
    const out: Features = {}
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
    for (const key of FEATURE_KEYS) {
        const v = (raw as Record<string, unknown>)[key]
        if (typeof v === "boolean") out[key] = v
    }
    return out
}

/** The number a limit allows; null = no limit (also when the plan does not mention it). */
export function limitOf(limits: Limits, key: LimitKey): number | null {
    const v = limits[key]
    return typeof v === "number" ? v : null
}

export type LimitCheck = {
    key: LimitKey
    limit: number | null
    used: number
    /** Room for `adding` more */
    allowed: boolean
    /** How many more fit; null = no limit */
    remaining: number | null
}

export function evaluateLimit(key: LimitKey, limit: number | null, used: number, adding = 1): LimitCheck {
    if (limit === null) return { key, limit, used, allowed: true, remaining: null }
    return { key, limit, used, allowed: used + adding <= limit, remaining: Math.max(0, limit - used) }
}

/** The sentence shown when a limit stops something. */
export function limitMessage(check: LimitCheck, planName: string): string {
    const noun = check.limit === 1 ? LIMIT_LABEL[check.key].one : LIMIT_LABEL[check.key].many
    return `The ${planName} plan allows ${check.limit ?? "unlimited"} ${noun}. Upgrade the plan to add more.`
}

/** Limits stop actions only when switched on, so nothing changes for anyone until the plans are decided. */
export function limitsEnforced(env: Record<string, string | undefined> = process.env): boolean {
    return env.PLAN_LIMITS === "on"
}

export type SubscriptionInput = {
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
    trialEndsAt: Date | null
    currentPeriodEnd: Date | null
    plan: { key: string }
}

export type PlanInForce = {
    /** The plan whose limits apply now */
    key: string
    /** Why it is that one */
    reason: "free" | "subscription" | "trial" | "past_due" | "trial_ended" | "period_ended" | "canceled"
}

/**
 * Which plan applies right now.
 *   no subscription            FREE
 *   ACTIVE                     its plan (until the paid period ends, if it has an end; then FREE)
 *   TRIALING                   its plan until the trial ends, then FREE
 *   PAST_DUE                   its plan (a grace period: the platform team decides when to cancel)
 *   CANCELED                   its plan until the paid period ends, then FREE
 */
export function planInForce(sub: SubscriptionInput | null, now: Date): PlanInForce {
    if (!sub) return { key: FREE_PLAN_KEY, reason: "free" }
    const ended = (d: Date | null) => d !== null && d.getTime() <= now.getTime()
    switch (sub.status) {
        case "ACTIVE":
            return ended(sub.currentPeriodEnd)
                ? { key: FREE_PLAN_KEY, reason: "period_ended" }
                : { key: sub.plan.key, reason: "subscription" }
        case "TRIALING":
            return ended(sub.trialEndsAt)
                ? { key: FREE_PLAN_KEY, reason: "trial_ended" }
                : { key: sub.plan.key, reason: "trial" }
        case "PAST_DUE":
            return { key: sub.plan.key, reason: "past_due" }
        case "CANCELED":
            return sub.currentPeriodEnd !== null && !ended(sub.currentPeriodEnd)
                ? { key: sub.plan.key, reason: "canceled" }
                : { key: FREE_PLAN_KEY, reason: "canceled" }
    }
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionInput["status"], string> = {
    TRIALING: "Trial",
    ACTIVE: "Active",
    PAST_DUE: "Payment overdue",
    CANCELED: "Canceled",
}

// ---- Prices ----------------------------------------------------------------------------------

type Priced = { key: string; priceMonthly: number | null; priceYearly: number | null }

/** 40 -> "40", 33.333 -> "33.33" (no trailing zeros) */
export function formatAmount(n: number): string {
    return String(Number(n.toFixed(2)))
}

const money = (n: number) => `${formatAmount(n)} ${CURRENCY}`

/** What the yearly price saves against twelve monthly payments, or null when there is no saving to show. */
export function yearlySaving(plan: Pick<Priced, "priceMonthly" | "priceYearly">): { amount: number; percent: number } | null {
    if (plan.priceMonthly === null || plan.priceYearly === null || plan.priceMonthly <= 0) return null
    const full = plan.priceMonthly * 12
    const amount = full - plan.priceYearly
    if (amount <= 0) return null
    return { amount, percent: Math.round((amount / full) * 100) }
}

export type PriceDisplay = {
    /** The big part of the price for the chosen period: "40", "Free" or "Price on request" */
    amount: string
    /** The small part after it: "TND / month", or null when there is none */
    unit: string | null
    /** The price for the chosen period in one line, for example "40 TND / month" */
    main: string
    /** The other period, so both prices are always visible */
    sub: string | null
    /** "Save 17%" on the yearly view when the yearly price is lower */
    badge: string | null
}

/**
 * How a plan's price is shown for the chosen period. The free plan says "Free"; a paid plan with no
 * price yet says "Price on request"; a plan with only one of the two prices works the other out
 * (without a saving) so the switch never shows an empty card.
 */
export function priceDisplay(plan: Priced, period: BillingPeriod): PriceDisplay {
    if (plan.key === FREE_PLAN_KEY) return { amount: "Free", unit: null, main: "Free", sub: null, badge: null }
    if (plan.priceMonthly === null && plan.priceYearly === null) {
        return { amount: "Price on request", unit: null, main: "Price on request", sub: null, badge: null }
    }
    const monthly = plan.priceMonthly ?? plan.priceYearly! / 12
    const yearly = plan.priceYearly ?? plan.priceMonthly! * 12
    const saving = yearlySaving(plan)
    if (period === "monthly") {
        return { amount: formatAmount(monthly), unit: `${CURRENCY} / month`, main: `${money(monthly)} / month`, sub: `or ${money(yearly)} / year`, badge: null }
    }
    return {
        amount: formatAmount(yearly),
        unit: `${CURRENCY} / year`,
        main: `${money(yearly)} / year`,
        sub: `about ${money(yearly / 12)} / month`,
        badge: saving ? `Save ${saving.percent}%` : null,
    }
}

// ---- What the tables show ---------------------------------------------------------------------

/** The plan most people should look at first; the public page marks it. */
export const POPULAR_PLAN_KEY = "PRO"

/**
 * Rows that are listed so people can see what is coming but are not built (or not applied) yet. They get
 * a "Soon" tag. Remove a key from here when it works.
 */
export const SOON_KEYS: ReadonlySet<string> = new Set([
    "customRoles", "customTaxes",
    "advancedReports", "invoicing", "bulkImport", "apiAccess", "priorityPlacement", "prioritySupport",
])

export type ComparisonRow = { kind: "limit"; key: LimitKey } | { kind: "feature"; key: FeatureKey }

export const COMPARISON_GROUPS: readonly { title: string; rows: readonly ComparisonRow[] }[] = [
    {
        title: "Your business",
        rows: [
            { kind: "limit", key: "shops" },
            { kind: "limit", key: "products" },
            { kind: "limit", key: "teamSeats" },
            { kind: "limit", key: "customRoles" },
        ],
    },
    {
        title: "Running the shop",
        rows: [
            { kind: "limit", key: "warehouses" },
            { kind: "limit", key: "customTaxes" },
            { kind: "feature", key: "lowStockAlerts" },
            { kind: "feature", key: "bulkImport" },
        ],
    },
    {
        title: "Reports and integrations",
        rows: [
            { kind: "feature", key: "advancedReports" },
            { kind: "feature", key: "invoicing" },
            { kind: "feature", key: "apiAccess" },
        ],
    },
    {
        title: "Visibility and support",
        rows: [
            { kind: "feature", key: "priorityPlacement" },
            { kind: "feature", key: "prioritySupport" },
        ],
    },
]

/** What every plan has, so the table only shows what differs. */
export const EVERY_PLAN_INCLUDES: readonly string[] = [
    "A shop page with its address and a pin on the map",
    "Products linked to the shared catalogue, with price comparison",
    "Team roles and permissions, with an invitation link for each person",
    "An activity log of who changed what",
    "Notifications for approvals and team changes",
    "Your data stays yours: nothing is removed when you change plan",
]

export function rowLabel(row: ComparisonRow): string {
    if (row.kind === "feature") return FEATURE_LABEL[row.key]
    const l = LIMIT_LABEL[row.key].many
    return l.charAt(0).toUpperCase() + l.slice(1)
}

export const isSoon = (row: ComparisonRow) => SOON_KEYS.has(row.key)

/** "Up to 3 shops", "1 shop", "Unlimited products" */
export function limitPhrase(key: LimitKey, limit: number | null): string {
    const label = LIMIT_LABEL[key]
    if (limit === null) return `Unlimited ${label.many}`
    return limit === 1 ? `1 ${label.one}` : `Up to ${limit} ${label.many}`
}

export type Cell = { kind: "text"; text: string } | { kind: "yes" } | { kind: "no" }

/** What one cell of the comparison table says for one plan. */
export function cellFor(plan: { limits: Limits; features: Features }, row: ComparisonRow): Cell {
    if (row.kind === "feature") return plan.features[row.key] ? { kind: "yes" } : { kind: "no" }
    const limit = limitOf(plan.limits, row.key)
    return { kind: "text", text: limit === null ? "Unlimited" : String(limit) }
}

/** The short list on a plan card: the main limits, then up to `maxFeatures` features, then "and N more". */
export function planHighlights(plan: { limits: Limits; features: Features }, maxFeatures = 3): string[] {
    const out: string[] = (["shops", "products", "teamSeats"] as const).map((k) => limitPhrase(k, limitOf(plan.limits, k)))
    const on = FEATURE_KEYS.filter((k) => plan.features[k])
    for (const k of on.slice(0, maxFeatures)) out.push(FEATURE_LABEL[k])
    if (on.length > maxFeatures) out.push(`and ${on.length - maxFeatures} more`)
    return out
}
