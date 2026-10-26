import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import PlansTable from "@/components/business/PlansTable"
import { listPlans } from "@/lib/plan-limits"
import { CURRENCY } from "@/lib/plans"

export const metadata: Metadata = {
    title: "Plans",
    description: "Start free. Move to a paid plan when your business grows: more shops, products and team members.",
}

export default function PublicPlansPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Plans</h1>
                <p className="mt-3 text-base leading-relaxed text-zinc-600">
                    Start free. Move to a paid plan when your business grows and needs more shops, products or team members.
                </p>
            </div>

            <div className="mt-8">
                <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                    <Plans />
                </Suspense>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800">
                    Start free
                </Link>
                <Link href="/login" className="inline-flex h-11 items-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                    Log in
                </Link>
            </div>
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-zinc-500">
                Prices are in Tunisian dinars ({CURRENCY}) and are per business, not per shop: the limits count across all of the shops of a business.
                Paid plans are set up with the Bayna team for now. Security features (two-step sign-in, the activity log, notifications) are never limited.
            </p>
        </div>
    )
}

async function Plans() {
    const plans = await listPlans()
    return (
        <PlansTable
            currentKey=""
            plans={plans.map(({ key, name, priceMonthly, priceYearly, limits, features }) => ({ key, name, priceMonthly, priceYearly, limits, features }))}
        />
    )
}
