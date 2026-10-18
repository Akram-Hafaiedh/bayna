"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/Toast"
import type { Unit } from "@/app/generated/prisma/enums"
import { CatalogItemForm, useAdminCategories } from "@/components/admin/catalog-shared"

type Similar = { id: string; name: string; brand: string | null; unit: string }
type Suggestion = {
    id: string
    name: string
    nameAr: string | null
    brand: string | null
    unit: Unit
    categoryId: string
    note: string | null
    status: "PENDING" | "APPROVED" | "REJECTED"
    reviewNote: string | null
    createdAt: string
    provider: { businessName: string; city: string }
    category: { id: string; name: string }
    catalogItem: { id: string; name: string } | null
    similar: Similar[]
}

const FILTERS = ["pending", "approved", "rejected"] as const

export default function CatalogueRequestsPage() {
    const { categories } = useAdminCategories()
    const [reviewing, setReviewing] = useState<string | null>(null)
    const [items, setItems] = useState<Suggestion[]>([])
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending")
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState<string | null>(null)
    const [reviewNote, setReviewNote] = useState("")
    const [error, setError] = useState("")
    const toast = useToast()

    async function load(f = filter) {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(`/api/admin/suggestions?status=${f}`)
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to load")
                return
            }
            setItems(data.suggestions || [])
        } catch {
            setError("Failed to load requests")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load(filter)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])

    /** Returns an error message, or null on success. */
    async function act(id: string, action: "approve" | "reject", body: object): Promise<string | null> {
        setBusyId(id)
        setError("")
        try {
            const res = await fetch(`/api/admin/suggestions/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) {
                const message = data.error || "Action failed"
                setError(message)
                return message
            }
            setRejecting(null)
            setReviewing(null)
            setReviewNote("")
            toast.success(action === "approve" ? "Request approved" : "Request rejected")
            await load()
            return null
        } catch {
            setError("Action failed")
            return "Action failed"
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        Catalogue requests
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Items providers want added to the shared catalogue. Approving links their
                        product so it appears in price comparisons.
                    </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-sm rounded-md capitalize ${filter === f ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-zinc-500">Loading...</p>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                    No {filter} requests.
                </div>
            ) : (
                <ul className="space-y-4">
                    {items.map((s) => (
                        <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-zinc-900">{s.name}</p>
                                    {s.nameAr && <p className="text-sm text-zinc-500" dir="rtl">{s.nameAr}</p>}
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {[s.brand, s.category.name, s.unit.toLowerCase().replace("_", " ")]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                </div>
                                <p className="text-xs text-zinc-400 text-right">
                                    {s.provider.businessName}, {s.provider.city}
                                    <br />
                                    {new Date(s.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            {s.note && (
                                <p className="rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-600">{s.note}</p>
                            )}

                            {s.status === "PENDING" ? (
                                <>
                                    {s.similar.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-zinc-700">
                                                Already in the catalogue? Link to an existing item instead
                                            </p>
                                            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                                                {s.similar.map((m) => (
                                                    <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                                                        <span className="min-w-0 truncate text-sm text-zinc-800">
                                                            {m.name}
                                                            {m.brand ? ` · ${m.brand}` : ""}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={busyId === s.id}
                                                            onClick={() => void act(s.id, "approve", { catalogItemId: m.id })}
                                                            className="shrink-0 text-xs font-medium text-zinc-700 hover:underline disabled:opacity-50"
                                                        >
                                                            Link to this
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-xs text-zinc-400">
                                                Linking changes the provider&apos;s product to that item&apos;s unit and category.
                                            </p>
                                        </div>
                                    )}

                                    {reviewing === s.id && (
                                        <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
                                            <p className="text-sm font-medium text-zinc-700">
                                                Check the details, fix anything that is off, then add it. The provider&apos;s
                                                product is linked to the new item.
                                            </p>
                                            <CatalogItemForm
                                                categories={categories}
                                                initial={{
                                                    name: s.name,
                                                    nameAr: s.nameAr ?? "",
                                                    brand: s.brand ?? "",
                                                    description: "",
                                                    unit: s.unit,
                                                    categoryId: s.categoryId,
                                                }}
                                                submitLabel="Add to catalogue"
                                                onSubmit={(v) => act(s.id, "approve", v)}
                                                onCancel={() => setReviewing(null)}
                                            />
                                        </div>
                                    )}

                                    {rejecting === s.id ? (
                                        <div className="space-y-2">
                                            <input
                                                value={reviewNote}
                                                onChange={(e) => setReviewNote(e.target.value)}
                                                placeholder="Reason (shown to the provider, optional)"
                                                aria-label="Reason for rejecting"
                                                maxLength={500}
                                                className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                            />
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    disabled={busyId === s.id}
                                                    onClick={() => void act(s.id, "reject", { reviewNote })}
                                                    className="h-9 px-4 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    Reject request
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRejecting(null)}
                                                    className="text-sm text-zinc-500 hover:text-zinc-900"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : reviewing === s.id ? null : (
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                disabled={busyId === s.id}
                                                onClick={() => setReviewing(s.id)}
                                                className="h-9 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                                            >
                                                Review and add to catalogue
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRejecting(s.id)
                                                    setReviewNote("")
                                                }}
                                                className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:border-zinc-400"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-zinc-500">
                                    {s.status === "APPROVED"
                                        ? `Approved${s.catalogItem ? `: linked to “${s.catalogItem.name}”` : ""}`
                                        : `Rejected${s.reviewNote ? `: ${s.reviewNote}` : ""}`}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
