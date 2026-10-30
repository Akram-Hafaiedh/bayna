"use client"

// The plan comparison on Business > Subscription (compact, it sits inside the dashboard), with the
// Monthly / Yearly switch. The public page uses the same table, roomier (components/plans/PublicPlans.tsx).
// The prices come from the database (Plan.priceMonthly and priceYearly).
import { useState } from "react"
import BillingToggle from "@/components/plans/BillingToggle"
import ComparisonTable from "@/components/plans/ComparisonTable"
import type { PlanRow } from "@/components/plans/types"
import { yearlySaving, type BillingPeriod } from "@/lib/plans/plans"

export type PlansTableRow = PlanRow

export default function PlansTable({ plans, currentKey }: { plans: PlansTableRow[]; currentKey: string }) {
    const [period, setPeriod] = useState<BillingPeriod>("monthly")
    const best = Math.max(0, ...plans.map((p) => yearlySaving(p)?.percent ?? 0))

    return (
        <section className="rounded-xl border border-zinc-200 bg-white text-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">Plans</h2>
                <BillingToggle period={period} onChange={setPeriod} saving={best} />
            </div>
            <ComparisonTable plans={plans} period={period} currentKey={currentKey} />
        </section>
    )
}
