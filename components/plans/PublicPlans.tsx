"use client"

// The pricing section of the public plans page: the switch, one card per plan, then the full comparison.
// Prices and limits are read from the database by the page and passed in, so changing them there changes this.
import { useState } from "react"
import Link from "next/link"
import BillingToggle from "./BillingToggle"
import ComparisonTable from "./ComparisonTable"
import type { PlanRow } from "./types"
import { POPULAR_PLAN_KEY, FREE_PLAN_KEY, planHighlights, priceDisplay, yearlySaving, type BillingPeriod } from "@/lib/plans/plans"

const Check = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export default function PublicPlans({ plans }: { plans: PlanRow[] }) {
    const [period, setPeriod] = useState<BillingPeriod>("yearly")
    const best = Math.max(0, ...plans.map((p) => yearlySaving(p)?.percent ?? 0))

    return (
        <div className="text-zinc-900">
            <div className="flex justify-center">
                <BillingToggle period={period} onChange={setPeriod} saving={best} size="large" />
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3 md:items-stretch">
                {plans.map((p) => {
                    const price = priceDisplay(p, period)
                    const popular = p.key === POPULAR_PLAN_KEY
                    const free = p.key === FREE_PLAN_KEY
                    return (
                        <div
                            key={p.key}
                            className={`relative flex flex-col rounded-2xl bg-white p-7 ${popular ? "border-2 border-zinc-900 shadow-lg" : "border border-zinc-200"}`}
                        >
                            {popular && (
                                <span className="absolute -top-3 left-7 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
                            )}
                            <h3 className="text-lg font-semibold text-zinc-900">{p.name}</h3>
                            <p className="mt-1 min-h-[2.5rem] text-sm leading-relaxed text-zinc-600">{p.description}</p>

                            <div className="mt-6 flex items-baseline gap-1.5">
                                <span className={`font-semibold tracking-tight text-zinc-900 ${price.unit ? "text-5xl" : "text-3xl"}`}>{price.amount}</span>
                                {price.unit && <span className="text-sm text-zinc-500">{price.unit}</span>}
                            </div>
                            <div className="mt-1 flex min-h-[1.5rem] flex-wrap items-center gap-2 text-sm text-zinc-500">
                                {price.sub && <span>{price.sub}</span>}
                                {price.badge && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{price.badge}</span>}
                            </div>

                            <Link
                                href="/register"
                                className={`mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-medium transition ${popular ? "bg-zinc-900 text-white hover:bg-zinc-800" : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}
                            >
                                {free ? "Start free" : `Get started with ${p.name}`}
                            </Link>
                            {!free && <p className="mt-2 text-center text-xs text-zinc-500">Start free, move up when you are ready.</p>}

                            <ul className="mt-6 space-y-3 border-t border-zinc-100 pt-6 text-sm text-zinc-700">
                                {planHighlights(p).map((line) => (
                                    <li key={line} className="flex gap-2.5">
                                        <Check />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                })}
            </div>

            <div className="mt-16">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Compare the plans</h2>
                <p className="mt-2 text-sm text-zinc-600">Everything that differs from one plan to the next. Rows marked Soon are planned and not available yet.</p>
                <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <ComparisonTable plans={plans} period={period} roomy />
                </div>
            </div>
        </div>
    )
}
