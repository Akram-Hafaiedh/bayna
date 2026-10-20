import { Suspense } from "react"
import type { Metadata } from "next"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"

export const metadata: Metadata = { title: "Subscription" }

export default function BusinessSubscriptionPage() {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-200" />}>
                <SubscriptionContent />
            </Suspense>
        </div>
    )
}

async function SubscriptionContent() {
    const { business } = await requireBusinessArea()
    const perms = await businessCan(business.id, ["billing.subscription.view"] as const)
    return (
        <>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Subscription</h1>
                <p className="mt-1 text-sm text-zinc-500">The plan of {business.name}: what it includes and what it costs.</p>
            </div>
            {!perms["billing.subscription.view"] ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The subscription is for business owners and accountants.</p>
            ) : (
                <section className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center">
                    <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Coming soon</span>
                    <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
                        Plans arrive in the next release: a free plan, paid plans with limits (shops, team seats, products), and invoices for the business.
                        Until then every business works without limits.
                    </p>
                </section>
            )}
        </>
    )
}
