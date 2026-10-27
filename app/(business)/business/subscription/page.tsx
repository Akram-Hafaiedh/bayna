import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import PlansTable from "@/components/business/PlansTable"
import { listPlans, planForBusiness, usageAll } from "@/lib/plan-limits"
import { LIMIT_LABEL, SUBSCRIPTION_STATUS_LABEL, limitOf, limitsEnforced, type LimitKey, type PlanInForce } from "@/lib/plans"

export const metadata: Metadata = { title: "Subscription" }

const USED_KEYS: LimitKey[] = ["shops", "products", "teamSeats"] // the limits that can be counted today

const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

function statusLine(reason: PlanInForce["reason"], trialEndsAt: Date | null, periodEnd: Date | null): string {
    switch (reason) {
        case "free": return "This business is on the free plan."
        case "subscription": return periodEnd ? `Active until ${date(periodEnd)}.` : "Active."
        case "trial": return trialEndsAt ? `Trial until ${date(trialEndsAt)}.` : "Trial."
        case "past_due": return "The payment is overdue. The plan stays for now; contact support."
        case "trial_ended": return "The trial has ended, so the business is back on the free plan."
        case "period_ended": return "The paid period has ended, so the business is back on the free plan."
        case "canceled": return periodEnd && periodEnd.getTime() > Date.now() ? `Canceled. The plan stays until ${date(periodEnd)}.` : "Canceled. The business is on the free plan."
    }
}

export default function BusinessSubscriptionPage() {
    return (
        <div className="max-w-4xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <SubscriptionContent />
            </Suspense>
        </div>
    )
}

async function SubscriptionContent() {
    const { business } = await requireBusinessArea()
    const perms = await businessCan(business.id, ["billing.subscription.view"] as const)
    if (!perms["billing.subscription.view"]) {
        return (
            <>
                <Header name={business.name} />
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The subscription is for business owners and accountants.</p>
            </>
        )
    }

    const [current, plans, used] = await Promise.all([planForBusiness(business.id), listPlans(), usageAll(business.id)])
    const { plan, reason, subscription } = current

    return (
        <>
            <Header name={business.name} />

            {!limitsEnforced() && (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Limits are shown for information. They are not applied yet, so nothing is blocked.
                </p>
            )}

            <section className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-900">{plan.name} plan</h2>
                    {subscription && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</span>
                    )}
                </div>
                <p className="mt-1 text-sm text-zinc-600">{statusLine(reason, subscription?.trialEndsAt ?? null, subscription?.currentPeriodEnd ?? null)}</p>
                {subscription?.note && <p className="mt-1 text-xs text-zinc-500">{subscription.note}</p>}
                <p className="mt-3 text-xs text-zinc-500">Plans are set by the platform team for now. Contact support to change yours.</p>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-zinc-900">What you use</h2>
                <ul className="mt-3 space-y-4">
                    {USED_KEYS.map((key) => {
                        const limit = limitOf(plan.limits, key)
                        const n = used[key]
                        const over = limit !== null && n > limit
                        const full = limit !== null && n >= limit
                        const pct = limit === null || limit === 0 ? 0 : Math.min(100, Math.round((n / limit) * 100))
                        return (
                            <li key={key}>
                                <div className="flex items-baseline justify-between text-sm">
                                    <span className="capitalize text-zinc-800">{LIMIT_LABEL[key].many}</span>
                                    <span className="tabular-nums text-zinc-600">{n} of {limit === null ? "no limit" : limit}</span>
                                </div>
                                {limit !== null && (
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                                        <div className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-zinc-800"}`} style={{ width: `${pct}%` }} />
                                    </div>
                                )}
                                {over && <p className="mt-1 text-xs text-amber-700">Over the limit. Nothing is removed, but nothing new can be added.</p>}
                            </li>
                        )
                    })}
                </ul>
            </section>

            <PlansTable plans={plans.map(({ key, name, description, priceMonthly, priceYearly, limits, features }) => ({ key, name, description, priceMonthly, priceYearly, limits, features }))} currentKey={plan.key} />
            <p className="text-xs text-zinc-500">Security and safety features (two-step sign-in, the activity log, notifications) are never limited.</p>
        </>
    )
}

function Header({ name }: { name: string }) {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Subscription</h1>
            <p className="mt-1 text-sm text-zinc-500">The plan of {name}: what it includes and what you use.</p>
        </div>
    )
}
