"use client"

import { useCallback, useEffect, useState } from "react"
import type { Unit } from "@/app/generated/prisma/enums"
import { UNIT_LABELS } from "@/lib/units"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import {
    CatalogItemForm,
    CategorySelect,
    EMPTY_ITEM,
    inputClass,
    useAdminCategories,
    type ItemValues,
} from "@/components/admin/catalog-shared"

type Item = {
    id: string
    name: string
    nameAr: string | null
    brand: string | null
    description: string | null
    unit: Unit
    isActive: boolean
    category: { id: string; name: string }
    productCount: number
}

export default function AdminCataloguePage() {
    const { categories, error: catError } = useAdminCategories()
    const [items, setItems] = useState<Item[]>([])
    const [q, setQ] = useState("")
    const [debouncedQ, setDebouncedQ] = useState("")
    const [category, setCategory] = useState("")
    const [status, setStatus] = useState<"active" | "inactive" | "all">("active")
    const [page, setPage] = useState(1)
    const [pageCount, setPageCount] = useState(1)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const confirm = useConfirm()
    const toast = useToast()
    const [editing, setEditing] = useState<string | "new" | null>(null)

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQ(q)
            setPage(1)
        }, 250)
        return () => clearTimeout(t)
    }, [q])

    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const params = new URLSearchParams({ q: debouncedQ, status, page: String(page) })
            if (category) params.set("category", category)
            const res = await fetch(`/api/admin/catalog?${params}`)
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to load")
                return
            }
            setItems(data.items)
            setPageCount(data.pageCount)
            setTotal(data.total)
        } catch {
            setError("Failed to load the catalogue")
        } finally {
            setLoading(false)
        }
    }, [debouncedQ, category, status, page])

    useEffect(() => {
        load()
    }, [load])

    async function save(id: string | "new", v: ItemValues, confirmUnitChange = false): Promise<string | null> {
        const res = await fetch(id === "new" ? "/api/admin/catalog" : `/api/admin/catalog/${id}`, {
            method: id === "new" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(confirmUnitChange ? { ...v, confirmUnitChange: true } : v),
        })
        const data = await res.json()
        // A new unit flags the linked products for a price review: show who is affected and ask first
        if (res.status === 409 && data.needsConfirmation && !confirmUnitChange) {
            const yes = await confirm({
                title: "Change the unit?",
                message: data.message,
                confirmLabel: "Change unit and flag products",
            })
            if (!yes) return "Not saved. The unit was left as it is."
            return save(id, v, true)
        }
        if (!res.ok) return data.error || "Failed to save"
        setEditing(null)
        toast.success(id === "new" ? `"${v.name}" added to the catalogue` : `"${v.name}" saved`)
        await load()
        return null
    }

    async function setActive(item: Item, isActive: boolean) {
        setError("")
        const res = await fetch(`/api/admin/catalog/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive }),
        })
        if (!res.ok) {
            const data = await res.json()
            setError(data.error || "Failed to update")
            return
        }
        toast.success(isActive ? `"${item.name}" is active again` : `"${item.name}" archived`)
        await load()
    }

    const toValues = (i: Item): ItemValues => ({
        name: i.name,
        nameAr: i.nameAr ?? "",
        brand: i.brand ?? "",
        description: i.description ?? "",
        unit: i.unit,
        categoryId: i.category.id,
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Catalogue</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        The shared items providers link their products to. Unit and category changes apply to every
                        linked product.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing("new")}
                    className="h-10 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 self-start"
                >
                    Add item
                </button>
            </div>

            {(error || catError) && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error || catError}
                </div>
            )}

            {editing === "new" && (
                <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                    <h2 className="font-medium text-zinc-900">New catalogue item</h2>
                    <CatalogItemForm
                        categories={categories}
                        initial={EMPTY_ITEM}
                        submitLabel="Add to catalogue"
                        onSubmit={(v) => save("new", v)}
                        onCancel={() => setEditing(null)}
                    />
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_14rem_10rem]">
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, Arabic name or brand"
                    aria-label="Search the catalogue"
                    className={inputClass}
                />
                <CategorySelect
                    categories={categories}
                    value={category}
                    allowEmpty
                    emptyLabel="All categories"
                    onChange={(v) => {
                        setCategory(v)
                        setPage(1)
                    }}
                />
                <select
                    value={status}
                    aria-label="Status"
                    onChange={(e) => {
                        setStatus(e.target.value as typeof status)
                        setPage(1)
                    }}
                    className={inputClass}
                >
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                    <option value="all">All</option>
                </select>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                {loading && items.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">Loading...</p>
                ) : items.length === 0 ? (
                    <p className="p-8 text-center text-sm text-zinc-500">No catalogue items match.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100">
                        {items.map((i) => (
                            <li key={i.id} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-zinc-900">
                                            {i.name}
                                            {!i.isActive && (
                                                <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
                                                    Deactivated
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-zinc-400">
                                            {[i.brand, i.category.name, UNIT_LABELS[i.unit]].filter(Boolean).join(" · ")}
                                            {" · "}
                                            {i.productCount} {i.productCount === 1 ? "product" : "products"}
                                        </p>
                                    </div>
                                    <div className="flex gap-3 text-xs font-medium">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(editing === i.id ? null : i.id)}
                                            className="text-zinc-700 hover:underline"
                                        >
                                            {editing === i.id ? "Close" : "Edit"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActive(i, !i.isActive)}
                                            className={i.isActive ? "text-red-600 hover:underline" : "text-emerald-700 hover:underline"}
                                        >
                                            {i.isActive ? "Deactivate" : "Reactivate"}
                                        </button>
                                    </div>
                                </div>
                                {editing === i.id && (
                                    <div className="mt-4 rounded-lg bg-zinc-50 p-4">
                                        <CatalogItemForm
                                            categories={categories}
                                            initial={toValues(i)}
                                            submitLabel="Save changes"
                                            hint={
                                                i.productCount > 0
                                                    ? `Changing unit or category also updates ${i.productCount} linked ${i.productCount === 1 ? "product" : "products"}.`
                                                    : undefined
                                            }
                                            onSubmit={(v) => save(i.id, v)}
                                            onCancel={() => setEditing(null)}
                                        />
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>{total} {total === 1 ? "item" : "items"}</span>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <span>
                        Page {page} of {pageCount}
                    </span>
                    <button
                        type="button"
                        disabled={page >= pageCount}
                        onClick={() => setPage((p) => p + 1)}
                        className="h-8 px-3 rounded-lg border border-zinc-200 disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    )
}
