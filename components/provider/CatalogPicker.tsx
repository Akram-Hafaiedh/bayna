"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Unit } from "@/app/generated/prisma/enums"
import { UNIT_LABELS } from "@/lib/units"

export type CatalogResult = {
    id: string
    name: string
    nameAr: string | null
    brand: string | null
    unit: Unit
    category: { id: string; name: string }
    listedProductId: string | null
}

export default function CatalogPicker({
    onPick,
    onCantFind,
}: {
    onPick: (item: CatalogResult) => void
    /** Called with the current search text when the provider cannot find their item. */
    onCantFind: (query: string) => void
}) {
    const [q, setQ] = useState("")
    const [items, setItems] = useState<CatalogResult[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        const ctrl = new AbortController()
        const timer = setTimeout(
            async () => {
                setLoading(true)
                setError("")
                try {
                    const res = await fetch(
                        `/api/catalog?q=${encodeURIComponent(q.trim())}&limit=12`,
                        { signal: ctrl.signal }
                    )
                    const data = await res.json()
                    if (!res.ok) {
                        setError(data.error || "Search failed")
                        return
                    }
                    setItems(data.items)
                } catch (e) {
                    if ((e as Error).name !== "AbortError") setError("Search failed")
                } finally {
                    if (!ctrl.signal.aborted) setLoading(false)
                }
            },
            q ? 250 : 0
        )
        return () => {
            clearTimeout(timer)
            ctrl.abort()
        }
    }, [q])

    return (
        <div className="space-y-3">
            <input
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the catalogue (e.g. cement, brake pads)"
                aria-label="Search the catalogue"
                className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                            <p className="truncate text-xs text-zinc-400">
                                {[item.brand, item.category.name, UNIT_LABELS[item.unit]]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        </div>
                        {item.listedProductId ? (
                            <Link
                                href={`/provider/products/${item.listedProductId}/edit`}
                                className="shrink-0 text-xs text-zinc-500 hover:text-zinc-900"
                            >
                                Already listed · Edit
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onPick(item)}
                                className="shrink-0 h-8 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:border-zinc-400"
                            >
                                Select
                            </button>
                        )}
                    </li>
                ))}
                {!loading && items.length === 0 && (
                    <li className="px-3.5 py-6 text-center text-sm text-zinc-500">
                        No catalogue item found{q.trim() ? ` for “${q.trim()}”` : ""}.
                    </li>
                )}
                {loading && items.length === 0 && (
                    <li className="px-3.5 py-6 text-center text-sm text-zinc-400">Searching...</li>
                )}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3.5 py-3 text-sm">
                <p className="text-zinc-600">Can&apos;t find it?</p>
                <button
                    type="button"
                    onClick={() => onCantFind(q.trim())}
                    className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                >
                    Add it as a custom product and suggest it for the catalogue
                </button>
            </div>
        </div>
    )
}
