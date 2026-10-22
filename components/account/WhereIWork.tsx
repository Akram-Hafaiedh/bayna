"use client"
// components/account/WhereIWork.tsx
// "Where I work": the shops the signed-in person works in, with the role that gives them access,
// and applications still waiting. Feeds from /api/me/shops (the same list as the shop switcher).
// Hidden for people who work nowhere, so a plain client sees nothing new on their profile.
import { useEffect, useState } from "react"
import Link from "next/link"

type Shop = {
    id: string
    name: string
    city: string
    businessId: string
    businessName: string
    roles: string[]
    status: "ACTIVE" | "PENDING"
}

export default function WhereIWork() {
    const [shops, setShops] = useState<Shop[] | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch("/api/me/shops", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : { shops: [] }))
            .then((d) => { if (!cancelled) setShops(Array.isArray(d.shops) ? d.shops : []) })
            .catch(() => { if (!cancelled) setShops([]) })
        return () => { cancelled = true }
    }, [])

    if (!shops || shops.length === 0) return null

    // Group by business so "Business owner" is shown once, not under every shop
    const groups = new Map<string, { name: string; shops: Shop[] }>()
    for (const s of shops) {
        const g = groups.get(s.businessId)
        if (g) g.shops.push(s)
        else groups.set(s.businessId, { name: s.businessName, shops: [s] })
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900">Where I work</h2>
            <p className="mb-4 text-sm text-zinc-500">The shops you can open, and the role that gives you access.</p>
            <div className="space-y-4">
                {[...groups.entries()].map(([businessId, { name: business, shops: list }]) => (
                    <div key={businessId}>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{business}</p>
                        <ul className="mt-1 divide-y divide-zinc-100 text-sm">
                            {list.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <span className="min-w-0">
                                        <span className="font-medium text-zinc-900">{s.name}</span>
                                        <span className="ml-2 text-zinc-400">{s.city}</span>
                                    </span>
                                    {s.status === "PENDING" ? (
                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Waiting for approval</span>
                                    ) : (
                                        <span className="flex flex-wrap gap-1.5">
                                            {s.roles.map((r) => (
                                                <span key={r} className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-700">{r}</span>
                                            ))}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <Link href="/provider/dashboard" className="mt-4 inline-block text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                Open the provider area
            </Link>
        </section>
    )
}
