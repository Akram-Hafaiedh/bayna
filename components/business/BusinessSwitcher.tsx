"use client"
// components/business/BusinessSwitcher.tsx
// Shows which business the Business area is about, and lets a person who belongs to several pick
// another. One business: just its name. The server checks the choice against the person's roles.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"

export default function BusinessSwitcher({
    businesses,
    activeId,
}: {
    businesses: { id: string; name: string; shopCount: number }[]
    activeId: string
}) {
    const router = useRouter()
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    const active = businesses.find((b) => b.id === activeId)

    async function choose(id: string) {
        if (id === activeId) return
        setBusy(true)
        try {
            const res = await fetch("/api/me/active-business", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId: id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not switch business", { description: data.error })
                return
            }
            toast.success(`Now looking at ${data.name}`)
            router.refresh()
        } catch {
            toast.error("Something went wrong", { description: "The business was not switched." })
        } finally {
            setBusy(false)
        }
    }

    if (businesses.length <= 1) {
        return (
            <div className="flex h-8 max-w-56 items-center gap-2 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Business</span>
                <span className="truncate font-medium text-zinc-900">{active?.name}</span>
                {active && <span className="shrink-0 text-xs text-zinc-400">{active.shopCount} {active.shopCount === 1 ? "shop" : "shops"}</span>}
            </div>
        )
    }

    return (
        <label className="flex h-8 items-center gap-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Business</span>
            <select
                aria-label="Business"
                value={activeId}
                disabled={busy}
                onChange={(e) => void choose(e.target.value)}
                className="h-8 max-w-56 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
            >
                {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} · {b.shopCount} {b.shopCount === 1 ? "shop" : "shops"}</option>
                ))}
            </select>
        </label>
    )
}
