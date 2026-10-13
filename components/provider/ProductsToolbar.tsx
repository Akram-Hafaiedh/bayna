"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    buildProductsHref,
    hasActiveFilters,
    type ProductFilters,
} from "@/lib/product-filters"
import { UNIT_OPTIONS } from "@/lib/units"
import type { CategoryOption } from "@/lib/provider-products"

const selectClass =
    "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"

export default function ProductsToolbar({
    filters,
    categories,
}: {
    filters: ProductFilters
    categories: CategoryOption[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Local text state so typing stays instant; the URL is updated after a pause.
    const [q, setQ] = useState(filters.q)
    const [prevUrlQ, setPrevUrlQ] = useState(filters.q)
    const [pushedQ, setPushedQ] = useState(filters.q)
    if (filters.q !== prevUrlQ) {
        // URL changed: if it was not our own push (back/forward), follow it
        setPrevUrlQ(filters.q)
        if (filters.q !== pushedQ) {
            setQ(filters.q)
            setPushedQ(filters.q)
        }
    }

    function go(overrides: Partial<ProductFilters>) {
        startTransition(() => {
            router.replace(buildProductsHref(filters, overrides), { scroll: false })
        })
    }

    useEffect(() => {
        const next = q.trim()
        if (next === filters.q) return
        const timer = setTimeout(() => {
            setPushedQ(next)
            startTransition(() => {
                router.replace(buildProductsHref(filters, { q: next }), { scroll: false })
            })
        }, 300)
        return () => clearTimeout(timer)
    }, [q, filters, router])

    function clearAll() {
        setQ("")
        setPushedQ("")
        go({ q: "", categoryId: null, status: "all", stock: "all", linked: "all", unit: null })
    }

    return (
        <div className="space-y-3" aria-busy={isPending}>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, brand or SKU"
                    aria-label="Search products"
                    className="h-10 w-full sm:w-72 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />

                <select
                    aria-label="Category"
                    value={filters.categoryId ?? ""}
                    onChange={(e) => go({ categoryId: e.target.value || null })}
                    className={selectClass}
                >
                    <option value="">All categories</option>
                    {categories.map((root) =>
                        root.children.length > 0 ? (
                            <optgroup key={root.id} label={root.name}>
                                <option value={root.id}>
                                    All {root.name} ({root.count})
                                </option>
                                {root.children.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.count})
                                    </option>
                                ))}
                            </optgroup>
                        ) : (
                            <option key={root.id} value={root.id}>
                                {root.name} ({root.count})
                            </option>
                        )
                    )}
                </select>

                <select
                    aria-label="Status"
                    value={filters.status}
                    onChange={(e) => go({ status: e.target.value as ProductFilters["status"] })}
                    className={selectClass}
                >
                    <option value="all">Any status</option>
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                </select>

                <select
                    aria-label="Stock"
                    value={filters.stock}
                    onChange={(e) => go({ stock: e.target.value as ProductFilters["stock"] })}
                    className={selectClass}
                >
                    <option value="all">Any stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                </select>

                <select
                    aria-label="Catalogue link"
                    value={filters.linked}
                    onChange={(e) => go({ linked: e.target.value as ProductFilters["linked"] })}
                    className={selectClass}
                >
                    <option value="all">Catalogue + custom</option>
                    <option value="yes">Catalogue items</option>
                    <option value="no">Custom products</option>
                </select>

                <select
                    aria-label="Unit"
                    value={filters.unit ?? ""}
                    onChange={(e) =>
                        go({ unit: (e.target.value || null) as ProductFilters["unit"] })
                    }
                    className={selectClass}
                >
                    <option value="">Any unit</option>
                    {UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>
                            {u.label}
                        </option>
                    ))}
                </select>

                {(hasActiveFilters(filters) || q) && (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="h-10 px-3 text-sm text-zinc-500 hover:text-zinc-900"
                    >
                        Clear filters
                    </button>
                )}
                {isPending && <span className="text-xs text-zinc-400">Updating...</span>}
            </div>
        </div>
    )
}
