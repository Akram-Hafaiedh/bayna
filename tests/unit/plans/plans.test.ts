// tests/unit/plans/plans.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    COMPARISON_GROUPS, DEFAULT_PLANS, FEATURE_KEYS, FREE_PLAN_KEY, LIMIT_KEYS, SOON_KEYS, cellFor, evaluateLimit,
    formatAmount, limitMessage, limitOf, limitPhrase, limitsEnforced, parseFeatures, parseLimits, planHighlights,
    planInForce, priceDisplay, rowLabel, yearlySaving, type SubscriptionInput,
} from "@/lib/plans/plans"

const NOW = new Date("2026-10-26T12:00:00Z")
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)
const sub = (extra: Partial<SubscriptionInput>): SubscriptionInput => ({
    status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: null, plan: { key: "PRO" }, ...extra,
})

test("the default plans start with FREE, rise in size, and name every limit", () => {
    assert.equal(DEFAULT_PLANS[0].key, FREE_PLAN_KEY)
    const free = DEFAULT_PLANS[0].limits
    const pro = DEFAULT_PLANS[1].limits
    for (const k of LIMIT_KEYS) assert.ok(k in free && k in pro, k)
    assert.ok((pro.products as number) > (free.products as number))
    assert.equal(DEFAULT_PLANS[2].limits.products, null)
})

test("a limit stops the next item only when it would go over", () => {
    assert.equal(evaluateLimit("shops", 1, 0).allowed, true)
    assert.equal(evaluateLimit("shops", 1, 1).allowed, false)
    assert.equal(evaluateLimit("products", 50, 49).allowed, true)
    assert.equal(evaluateLimit("products", 50, 50).allowed, false)
    assert.equal(evaluateLimit("products", 50, 45, 6).allowed, false)
    assert.equal(evaluateLimit("products", 50, 45, 5).allowed, true)
    assert.equal(evaluateLimit("products", 50, 60).remaining, 0)
})

test("no limit means unlimited, whether null or missing", () => {
    assert.equal(evaluateLimit("products", null, 100000).allowed, true)
    assert.equal(evaluateLimit("products", null, 5).remaining, null)
    assert.equal(limitOf({}, "shops"), null)
    assert.equal(limitOf({ shops: null }, "shops"), null)
    assert.equal(limitOf({ shops: 3 }, "shops"), 3)
})

test("limits and features read from the database ignore anything unknown or malformed", () => {
    assert.deepEqual(parseLimits({ shops: 2, products: null, teamSeats: -1, warehouses: 1.5, colour: 9 }), { shops: 2, products: null })
    assert.deepEqual(parseLimits(null), {})
    assert.deepEqual(parseLimits([1, 2]), {})
    assert.deepEqual(parseFeatures({ bulkImport: true, apiAccess: "yes", nope: true }), { bulkImport: true })
    assert.deepEqual(parseFeatures("x"), {})
})

test("the limit message names the plan and the thing", () => {
    assert.equal(limitMessage(evaluateLimit("shops", 1, 1), "Free"), "The Free plan allows 1 shop. Upgrade the plan to add more.")
    assert.equal(limitMessage(evaluateLimit("teamSeats", 3, 3), "Pro"), "The Pro plan allows 3 team members. Upgrade the plan to add more.")
})

test("limits are off unless PLAN_LIMITS is on", () => {
    assert.equal(limitsEnforced({}), false)
    assert.equal(limitsEnforced({ PLAN_LIMITS: "off" }), false)
    assert.equal(limitsEnforced({ PLAN_LIMITS: "on" }), true)
})

test("no subscription means FREE", () => {
    assert.deepEqual(planInForce(null, NOW), { key: "FREE", reason: "free" })
})

test("an active subscription applies, until its paid period ends", () => {
    assert.deepEqual(planInForce(sub({}), NOW), { key: "PRO", reason: "subscription" })
    assert.deepEqual(planInForce(sub({ currentPeriodEnd: day(5) }), NOW), { key: "PRO", reason: "subscription" })
    assert.deepEqual(planInForce(sub({ currentPeriodEnd: day(-1) }), NOW), { key: "FREE", reason: "period_ended" })
})

test("a trial applies until it ends, then the business drops to FREE", () => {
    assert.deepEqual(planInForce(sub({ status: "TRIALING", trialEndsAt: day(3) }), NOW), { key: "PRO", reason: "trial" })
    assert.deepEqual(planInForce(sub({ status: "TRIALING", trialEndsAt: day(-1) }), NOW), { key: "FREE", reason: "trial_ended" })
})

test("an overdue payment keeps the plan for now, a cancellation keeps it to the end of the paid period", () => {
    assert.deepEqual(planInForce(sub({ status: "PAST_DUE" }), NOW), { key: "PRO", reason: "past_due" })
    assert.deepEqual(planInForce(sub({ status: "CANCELED", currentPeriodEnd: day(10) }), NOW), { key: "PRO", reason: "canceled" })
    assert.deepEqual(planInForce(sub({ status: "CANCELED", currentPeriodEnd: day(-1) }), NOW), { key: "FREE", reason: "canceled" })
    assert.deepEqual(planInForce(sub({ status: "CANCELED" }), NOW), { key: "FREE", reason: "canceled" })
})

// ---- prices ----
const PRO = { key: "PRO", priceMonthly: 40, priceYearly: 400 }

test("the default paid plans have both prices, the yearly one lower than twelve months, and Free has none", () => {
    assert.equal(DEFAULT_PLANS[0].priceMonthly, null)
    assert.equal(DEFAULT_PLANS[0].priceYearly, null)
    for (const p of DEFAULT_PLANS.slice(1)) {
        assert.ok(p.priceMonthly !== null && p.priceYearly !== null, p.key)
        assert.ok(p.priceYearly! < p.priceMonthly! * 12, p.key)
    }
})

test("the saving is what twelve months cost more than the yearly price", () => {
    assert.deepEqual(yearlySaving(PRO), { amount: 80, percent: 17 })
    assert.equal(yearlySaving({ priceMonthly: 40, priceYearly: 480 }), null)
    assert.equal(yearlySaving({ priceMonthly: 40, priceYearly: 500 }), null)
    assert.equal(yearlySaving({ priceMonthly: null, priceYearly: 400 }), null)
    assert.equal(yearlySaving({ priceMonthly: 0, priceYearly: 0 }), null)
})

test("amounts drop trailing zeros", () => {
    assert.equal(formatAmount(40), "40")
    assert.equal(formatAmount(33.3333), "33.33")
    assert.equal(formatAmount(12.5), "12.5")
})

test("the monthly view shows the monthly price and the yearly one beside it", () => {
    assert.deepEqual(priceDisplay(PRO, "monthly"), { amount: "40", unit: "TND / month", main: "40 TND / month", sub: "or 400 TND / year", badge: null })
})

test("the yearly view shows the yearly price, the monthly equivalent and the saving", () => {
    assert.deepEqual(priceDisplay(PRO, "yearly"), { amount: "400", unit: "TND / year", main: "400 TND / year", sub: "about 33.33 TND / month", badge: "Save 17%" })
})

test("Free says Free, and a paid plan without a price says price on request", () => {
    assert.deepEqual(priceDisplay({ key: "FREE", priceMonthly: null, priceYearly: null }, "yearly"), { amount: "Free", unit: null, main: "Free", sub: null, badge: null })
    assert.deepEqual(priceDisplay({ key: "PRO", priceMonthly: null, priceYearly: null }, "monthly"), { amount: "Price on request", unit: null, main: "Price on request", sub: null, badge: null })
})

test("a plan with one price only still shows both periods, without claiming a saving", () => {
    const onlyMonthly = priceDisplay({ key: "PRO", priceMonthly: 40, priceYearly: null }, "yearly")
    assert.equal(onlyMonthly.main, "480 TND / year")
    assert.equal(onlyMonthly.badge, null)
    const onlyYearly = priceDisplay({ key: "PRO", priceMonthly: null, priceYearly: 480 }, "monthly")
    assert.equal(onlyYearly.main, "40 TND / month")
})

// ---- what the tables show ----
test("every row of the comparison is a known limit or feature, once, and every key appears in some group", () => {
    const seen = COMPARISON_GROUPS.flatMap((g) => g.rows.map((r) => `${r.kind}:${r.key}`))
    assert.equal(new Set(seen).size, seen.length)
    for (const k of LIMIT_KEYS) assert.ok(seen.includes(`limit:${k}`), k)
    for (const k of FEATURE_KEYS) assert.ok(seen.includes(`feature:${k}`), k)
})

test("every default plan says something about every limit, and Business can do everything Pro can", () => {
    for (const p of DEFAULT_PLANS) for (const k of LIMIT_KEYS) assert.ok(k in p.limits, `${p.key} ${k}`)
    const pro = DEFAULT_PLANS[1]
    const business = DEFAULT_PLANS[2]
    for (const k of FEATURE_KEYS) if (pro.features[k]) assert.ok(business.features[k], k)
})

test("things that are not built yet are marked Soon, things that work are not", () => {
    assert.equal(SOON_KEYS.has("warehouses"), true)
    assert.equal(SOON_KEYS.has("invoicing"), true)
    assert.equal(SOON_KEYS.has("shops"), false)
    assert.equal(SOON_KEYS.has("products"), false)
    assert.equal(SOON_KEYS.has("teamSeats"), false)
})

test("limits read naturally on a plan card", () => {
    assert.equal(limitPhrase("shops", 1), "1 shop")
    assert.equal(limitPhrase("shops", 3), "Up to 3 shops")
    assert.equal(limitPhrase("teamSeats", 10), "Up to 10 team members")
    assert.equal(limitPhrase("products", null), "Unlimited products")
})

test("table cells: numbers and Unlimited for limits, yes or no for features", () => {
    const pro = DEFAULT_PLANS[1]
    assert.deepEqual(cellFor(pro, { kind: "limit", key: "shops" }), { kind: "text", text: "3" })
    assert.deepEqual(cellFor(DEFAULT_PLANS[2], { kind: "limit", key: "products" }), { kind: "text", text: "Unlimited" })
    assert.deepEqual(cellFor(pro, { kind: "feature", key: "advancedReports" }), { kind: "yes" })
    assert.deepEqual(cellFor(pro, { kind: "feature", key: "apiAccess" }), { kind: "no" })
    assert.equal(rowLabel({ kind: "limit", key: "teamSeats" }), "Team members")
    assert.equal(rowLabel({ kind: "feature", key: "apiAccess" }), "API access")
})

test("a plan card lists the main limits, the first features and how many more", () => {
    assert.deepEqual(planHighlights(DEFAULT_PLANS[0]), ["1 shop", "Up to 50 products", "1 team member"])
    const pro = planHighlights(DEFAULT_PLANS[1])
    assert.deepEqual(pro.slice(0, 3), ["Up to 3 shops", "Up to 500 products", "Up to 3 team members"])
    assert.equal(pro.length, 6) // three limits, three features, nothing left over
    const business = planHighlights(DEFAULT_PLANS[2])
    assert.equal(business[2], "Up to 10 team members")
    assert.equal(business.at(-1), "and 4 more")
})
