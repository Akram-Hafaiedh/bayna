// lib/plans/plan-limits.ts
// The database side of plans (the rules are in lib/plans/plans.ts): which plan a business is on, how much of
// each limit it has used, and the one helper every feature with a limit calls.
//
//   const blocked = await limitBlock(businessId, "products")
//   if (blocked) return NextResponse.json({ error: blocked, code: "plan_limit" }, { status: 403 })
//
// `limitBlock` returns a message only when limits are switched on (PLAN_LIMITS=on) AND this one is full.
// Works before the plans are seeded: a missing Plan row falls back to DEFAULT_PLANS.
import { prisma } from "@/lib/prisma"
import {
    DEFAULT_PLANS, FREE_PLAN_KEY, LIMIT_KEYS, defaultPlan, evaluateLimit, limitMessage, limitOf, limitsEnforced,
    parseFeatures, parseLimits, planInForce,
    type Features, type LimitCheck, type LimitKey, type Limits, type PlanInForce, type PlanDefinition,
} from "@/lib/plans/plans"

export type PlanView = PlanDefinition & { features: Features; limits: Limits }

export type BusinessPlan = {
    plan: PlanView
    reason: PlanInForce["reason"]
    /** The subscription row, when the business has one (null = it is simply on the free plan) */
    subscription: {
        status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
        planKey: string
        trialEndsAt: Date | null
        currentPeriodEnd: Date | null
        note: string | null
    } | null
}

type PlanRow = {
    key: string; name: string; description: string | null
    priceMonthly: { toString(): string } | null; priceYearly?: { toString(): string } | null
    limits: unknown; features: unknown; sortOrder: number
}

const toView = (p: PlanRow): PlanView => ({
    key: p.key,
    name: p.name,
    description: p.description ?? "",
    // `== null` also covers a client generated before the yearly column existed (the field is then missing)
    priceMonthly: p.priceMonthly == null ? null : Number(p.priceMonthly.toString()),
    priceYearly: p.priceYearly == null ? null : Number(p.priceYearly.toString()),
    // A limit or feature the row does not mention takes the default of that built-in plan, so a new row
    // in the plan tables needs no database change
    limits: { ...(defaultPlan(p.key)?.limits ?? {}), ...parseLimits(p.limits) },
    features: { ...(defaultPlan(p.key)?.features ?? {}), ...parseFeatures(p.features) },
    sortOrder: p.sortOrder,
})

/** The plans shown on the Subscription page: the database's, or the defaults before they are seeded. */
export async function listPlans(): Promise<PlanView[]> {
    const rows = await prisma.plan.findMany({ where: { isPublic: true }, orderBy: [{ sortOrder: "asc" }, { key: "asc" }] })
    return rows.length > 0 ? rows.map(toView) : DEFAULT_PLANS.map((p) => ({ ...p }))
}

/** The plan whose limits apply to this business right now. */
export async function planForBusiness(businessId: string, now: Date = new Date()): Promise<BusinessPlan> {
    const sub = await prisma.subscription.findUnique({
        where: { businessId },
        select: { status: true, trialEndsAt: true, currentPeriodEnd: true, note: true, plan: { select: { key: true } } },
    })
    const inForce = planInForce(sub, now)
    const row = await prisma.plan.findUnique({ where: { key: inForce.key } })
    const plan = row ? toView(row) : { ...(defaultPlan(inForce.key) ?? defaultPlan(FREE_PLAN_KEY)!) }
    return {
        plan,
        reason: inForce.reason,
        subscription: sub
            ? { status: sub.status, planKey: sub.plan.key, trialEndsAt: sub.trialEndsAt, currentPeriodEnd: sub.currentPeriodEnd, note: sub.note }
            : null,
    }
}

/** How much of one limit this business uses, counted across all of its shops. */
export async function usageFor(businessId: string, key: LimitKey): Promise<number> {
    switch (key) {
        case "shops":
            // A closed shop gives its place back
            return prisma.shop.count({ where: { businessId, deletedAt: null, status: { not: "CLOSED" } } })
        case "products":
            return prisma.product.count({ where: { deletedAt: null, shop: { businessId, deletedAt: null } } })
        case "teamSeats": {
            // One seat per person with a live role in the business or in any of its shops
            const rows = await prisma.accessAssignment.findMany({
                where: { status: "ACTIVE", OR: [{ businessId }, { shop: { businessId } }] },
                distinct: ["userId"],
                select: { userId: true },
            })
            return rows.length
        }
        case "warehouses":
            // Every live (not archived) warehouse of the business's shops; the default one of each shop counts too
            return prisma.warehouse.count({ where: { archivedAt: null, shop: { businessId, deletedAt: null } } })
        // Nothing to count yet: custom taxes do not exist (R7), and a role is not marked as custom, so custom
        // roles cannot be told apart from the default copies
        case "customRoles":
        case "customTaxes":
            return 0
    }
}

export async function usageAll(businessId: string): Promise<Record<LimitKey, number>> {
    const entries = await Promise.all(LIMIT_KEYS.map(async (k) => [k, await usageFor(businessId, k)] as const))
    return Object.fromEntries(entries) as Record<LimitKey, number>
}

/** Is there room for `adding` more of this? Always answers; says nothing about whether limits are on. */
export async function checkLimit(businessId: string, key: LimitKey, adding = 1): Promise<LimitCheck & { planName: string }> {
    const [{ plan }, used] = await Promise.all([planForBusiness(businessId), usageFor(businessId, key)])
    return { ...evaluateLimit(key, limitOf(plan.limits, key), used, adding), planName: plan.name }
}

/** The message to give when this action must be refused, or null when it may go ahead. */
export async function limitBlock(businessId: string, key: LimitKey, adding = 1): Promise<string | null> {
    if (!limitsEnforced()) return null
    const check = await checkLimit(businessId, key, adding)
    return check.allowed ? null : limitMessage(check, check.planName)
}

/** Does this person already take a seat in the business (so inviting them again adds none)? */
export async function holdsSeat(businessId: string, userId: string): Promise<boolean> {
    const n = await prisma.accessAssignment.count({
        where: { userId, status: "ACTIVE", OR: [{ businessId }, { shop: { businessId } }] },
    })
    return n > 0
}
