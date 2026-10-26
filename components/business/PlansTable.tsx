"use client"

// The plan comparison on Business > Subscription, with a Monthly / Yearly switch. Both prices are always
// visible: the chosen period is the big one, the other sits under it. The prices come from the database
// (Plan.priceMonthly and priceYearly), so changing them there changes this table.
import { useState } from "react"
import {
    FEATURE_KEYS, FEATURE_LABEL, LIMIT_KEYS, LIMIT_LABEL, limitOf, priceDisplay, yearlySaving,
    type BillingPeriod, type Features, type Limits,
} from "@/lib/plans"

export type PlansTableRow = {
    key: string
    name: string
    priceMonthly: number | null
    priceYearly: number | null
    limits: Limits
    features: Features
}

const PERIODS: { value: BillingPeriod; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
]

export default function PlansTable({ plans, currentKey }: { plans: PlansTableRow[]; currentKey: string }) {
    const [period, setPeriod] = useState<BillingPeriod>("monthly")
    const colSpan = plans.length + 1
    // The biggest saving on offer, shown on the Yearly button so the reason to switch is visible
    const best = Math.max(0, ...plans.map((p) => yearlySaving(p)?.percent ?? 0))

    return (
        <section className="rounded-xl border border-zinc-200 bg-white text-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">Plans</h2>
                <div role="group" aria-label="Billing period" className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-sm">
                    {PERIODS.map((p) => {
                        const on = period === p.value
                        return (
                            <button
                                key={p.value}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setPeriod(p.value)}
                                className={`rounded-md px-3 py-1 font-medium transition ${on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`}
                            >
                                {p.label}
                                {p.value === "yearly" && best > 0 && <span className="ml-1.5 text-xs font-semibold text-emerald-700">Save up to {best}%</span>}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm text-zinc-900">
                    <thead>
                        <tr className="border-b border-zinc-100 text-left">
                            <th className="px-5 py-3 font-medium text-zinc-500"><span className="sr-only">Plan</span></th>
                            {plans.map((p) => {
                                const price = priceDisplay(p, period)
                                const current = p.key === currentKey
                                return (
                                    <th key={p.key} className={`px-4 py-3 align-top font-normal ${current ? "bg-zinc-50" : ""}`}>
                                        <div className="font-semibold text-zinc-900">{p.name}</div>
                                        <div className="mt-1 text-base font-semibold text-zinc-900">{price.main}</div>
                                        {price.sub && <div className="text-xs text-zinc-500">{price.sub}</div>}
                                        {price.badge && <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{price.badge}</div>}
                                        {current && <div className="mt-1 text-xs font-medium text-zinc-700">Your plan</div>}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        <SectionRow label="What each plan allows" span={colSpan} />
                        {LIMIT_KEYS.map((key) => (
                            <tr key={key}>
                                <td className="px-5 py-2.5 capitalize text-zinc-700">{LIMIT_LABEL[key].many}</td>
                                {plans.map((p) => {
                                    const l = limitOf(p.limits, key)
                                    return <td key={p.key} className={`px-4 py-2.5 tabular-nums ${p.key === currentKey ? "bg-zinc-50" : ""}`}>{l === null ? "No limit" : l}</td>
                                })}
                            </tr>
                        ))}
                        <SectionRow label="Features" span={colSpan} />
                        {FEATURE_KEYS.map((key) => (
                            <tr key={key}>
                                <td className="px-5 py-2.5 text-zinc-700">{FEATURE_LABEL[key]}</td>
                                {plans.map((p) => (
                                    <td key={p.key} className={`px-4 py-2.5 ${p.key === currentKey ? "bg-zinc-50" : ""}`}>
                                        {p.features[key] ? <span className="font-medium text-emerald-700">&#10003; Included</span> : <span className="text-zinc-400" aria-label="Not included">&ndash;</span>}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

function SectionRow({ label, span }: { label: string; span: number }) {
    return (
        <tr className="bg-zinc-50/70">
            <td colSpan={span} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</td>
        </tr>
    )
}
