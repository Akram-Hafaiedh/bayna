import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import PublicPlans from "@/components/plans/PublicPlans"
import { listPlans } from "@/lib/plan-limits"
import { CURRENCY, EVERY_PLAN_INCLUDES } from "@/lib/plans"

export const metadata: Metadata = {
    title: "Plans and pricing",
    description: "Start free. Move to a paid plan when your business grows: more shops, products and team members.",
}

const FAQ: { q: string; a: string }[] = [
    {
        q: "Can I really start for free?",
        a: "Yes. The Free plan has no time limit and needs no card. You can list your products, add your shop to the map and invite a team member, and move up when you outgrow it.",
    },
    {
        q: "What counts as a team member?",
        a: "Everyone who has a role in your business or in any of its shops. A person who works in two of your shops is counted once.",
    },
    {
        q: "What happens if I go over a limit?",
        a: "Nothing you already created is removed or hidden. You just cannot add more of that item until you move to a bigger plan or free some room.",
    },
    {
        q: "What is the difference between monthly and yearly?",
        a: "The same plan. Paying for a year costs less than twelve monthly payments. Prices are in Tunisian dinars (" + CURRENCY + ") and are per business, not per shop.",
    },
    {
        q: "How do I pay, and can I change or cancel later?",
        a: "Paid plans are set up with the Bayna team for now, and online payment comes later. You can change plan at any time. When a paid period ends, your business goes back to Free and keeps all of its shops and products.",
    },
    {
        q: "What does Soon mean in the table?",
        a: "Those rows are planned and not available yet. We list them so you can see where each plan is going before you choose.",
    },
]

const Check = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export default function PublicPlansPage() {
    return (
        <div>
            <section className="border-b border-zinc-200 bg-white">
                <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Plans and pricing</p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">Simple plans that grow with your shops</h1>
                    <p className="mt-5 text-lg leading-relaxed text-zinc-600">
                        Start free. Move to a paid plan when you need more shops, more products or a bigger team. No surprises: nothing you built is ever taken away.
                    </p>
                </div>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
                <Suspense fallback={<div className="h-[34rem] animate-pulse rounded-2xl bg-zinc-200" />}>
                    <Plans />
                </Suspense>

                <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-7 sm:p-9">
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Included in every plan</h2>
                    <ul className="mt-6 grid gap-x-10 gap-y-4 text-[15px] text-zinc-700 sm:grid-cols-2">
                        {EVERY_PLAN_INCLUDES.map((line) => (
                            <li key={line} className="flex gap-3">
                                <Check />
                                <span>{line}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mx-auto mt-16 max-w-3xl">
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Questions</h2>
                    <div className="mt-6 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
                        {FAQ.map((item) => (
                            <details key={item.q} className="group px-6 py-4">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-zinc-900">
                                    {item.q}
                                    <span aria-hidden="true" className="text-xl leading-none text-zinc-400 transition group-open:rotate-45">+</span>
                                </summary>
                                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="mt-16 rounded-2xl bg-zinc-900 px-6 py-12 text-center sm:px-10">
                    <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Put your shop on the map</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">
                        Create your free account, add your shop and list your first products today. You can change plan whenever your business needs more.
                    </p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        <Link href="/register" className="inline-flex h-11 items-center rounded-lg bg-white px-6 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100">
                            Start free
                        </Link>
                        <Link href="/login" className="inline-flex h-11 items-center rounded-lg border border-zinc-600 px-6 text-sm font-medium text-white transition hover:bg-zinc-800">
                            Log in
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    )
}

async function Plans() {
    const plans = await listPlans()
    return (
        <PublicPlans
            plans={plans.map(({ key, name, description, priceMonthly, priceYearly, limits, features }) => ({ key, name, description, priceMonthly, priceYearly, limits, features }))}
        />
    )
}
