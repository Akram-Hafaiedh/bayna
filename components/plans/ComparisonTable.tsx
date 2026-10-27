"use client"

// The plan comparison: prices on top, then the rows of COMPARISON_GROUPS (lib/plans.ts). Used on the public
// plans page (roomy) and on Business > Subscription (compact). Text colours are set on purpose: the app's
// default text turns light in dark mode and these cards are white.
import { COMPARISON_GROUPS, cellFor, isSoon, priceDisplay, rowLabel, type BillingPeriod } from "@/lib/plans"
import type { PlanRow } from "./types"

export default function ComparisonTable({
    plans,
    period,
    currentKey,
    roomy = false,
}: {
    plans: PlanRow[]
    period: BillingPeriod
    /** Plan to mark as "Your plan"; leave empty on the public page */
    currentKey?: string
    roomy?: boolean
}) {
    const span = plans.length + 1
    const cellPad = roomy ? "px-5 py-3.5" : "px-4 py-2.5"
    const labelPad = roomy ? "px-6 py-3.5" : "px-5 py-2.5"
    const tint = (key: string) => (key === currentKey ? "bg-zinc-50" : "")

    return (
        <div className="overflow-x-auto">
            <table className={`w-full text-zinc-900 ${roomy ? "min-w-[40rem] text-[15px]" : "min-w-[34rem] text-sm"}`}>
                <thead>
                    <tr className="border-b border-zinc-200 text-left">
                        <th className={`${labelPad} font-medium text-zinc-500`}><span className="sr-only">Plan</span></th>
                        {plans.map((p) => {
                            const price = priceDisplay(p, period)
                            return (
                                <th key={p.key} className={`${cellPad} align-top font-normal ${tint(p.key)}`}>
                                    <div className="font-semibold text-zinc-900">{p.name}</div>
                                    <div className="mt-0.5 font-semibold text-zinc-900">{price.main}</div>
                                    {price.badge && <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{price.badge}</div>}
                                    {p.key === currentKey && <div className="mt-1 text-xs font-medium text-zinc-700">Your plan</div>}
                                </th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {COMPARISON_GROUPS.map((group) => (
                        <GroupRows key={group.title} title={group.title} span={span}>
                            {group.rows.map((row) => (
                                <tr key={`${row.kind}:${row.key}`}>
                                    <td className={`${labelPad} text-zinc-700`}>
                                        {rowLabel(row)}
                                        {isSoon(row) && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">Soon</span>}
                                    </td>
                                    {plans.map((p) => {
                                        const cell = cellFor(p, row)
                                        return (
                                            <td key={p.key} className={`${cellPad} ${tint(p.key)}`}>
                                                {cell.kind === "text" && <span className="tabular-nums text-zinc-900">{cell.text}</span>}
                                                {cell.kind === "yes" && <span className="font-medium text-emerald-700" aria-label="Included">&#10003;<span className="sr-only"> Included</span></span>}
                                                {cell.kind === "no" && <span className="text-zinc-300" aria-label="Not included">&ndash;</span>}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </GroupRows>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function GroupRows({ title, span, children }: { title: string; span: number; children: React.ReactNode }) {
    return (
        <>
            <tr className="bg-zinc-50/80">
                <td colSpan={span} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</td>
            </tr>
            {children}
        </>
    )
}
