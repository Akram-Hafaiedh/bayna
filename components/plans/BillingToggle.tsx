"use client"

// The Monthly / Yearly switch. `saving` is the biggest yearly saving on offer (a percent), shown on the
// Yearly button so the reason to switch is visible.
import type { BillingPeriod } from "@/lib/plans"

const PERIODS: { value: BillingPeriod; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
]

export default function BillingToggle({
    period,
    onChange,
    saving,
    size = "normal",
}: {
    period: BillingPeriod
    onChange: (p: BillingPeriod) => void
    saving: number
    size?: "normal" | "large"
}) {
    const pad = size === "large" ? "px-5 py-2 text-sm" : "px-3 py-1 text-sm"
    return (
        <div role="group" aria-label="Billing period" className="inline-flex rounded-xl bg-zinc-100 p-1">
            {PERIODS.map((p) => {
                const on = period === p.value
                return (
                    <button
                        key={p.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(p.value)}
                        className={`rounded-lg font-medium transition ${pad} ${on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`}
                    >
                        {p.label}
                        {p.value === "yearly" && saving > 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Save {saving}%</span>}
                    </button>
                )
            })}
        </div>
    )
}
