"use client"

import { useEffect, useState } from "react"

type ProviderRow = {
    id: string
    businessName: string
    city: string
    governorate: string | null
    phone: string | null
    isVerified: boolean
    needsReview: boolean
    latitude: number | null
    longitude: number | null
    createdAt: string
    user: {
        id: string
        email: string
        name: string | null
        role: string
    }
}

export default function AdminProvidersPage() {
    const [providers, setProviders] = useState<ProviderRow[]>([])
    const [filter, setFilter] = useState<"pending" | "verified" | "review" | "all">("pending")
    const [loading, setLoading] = useState(true)
    const [actionId, setActionId] = useState<string | null>(null)
    const [error, setError] = useState("")

    async function load(f = filter) {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(`/api/admin/providers?filter=${f}`)
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to load")
                return
            }
            setProviders(data.providers || [])
        } catch {
            setError("Failed to load providers")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load(filter)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])

    async function approve(id: string) {
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/providers/${id}/approve`, {
                method: "POST",
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Approve failed")
                return
            }
            await load()
        } catch {
            setError("Approve failed")
        } finally {
            setActionId(null)
        }
    }

    async function markReviewed(id: string) {
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/providers/${id}/reviewed`, { method: "POST" })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Could not mark as reviewed")
                return
            }
            await load()
        } catch {
            setError("Could not mark as reviewed")
        } finally {
            setActionId(null)
        }
    }

    async function reject(id: string) {
        if (!confirm("Reject this application? The provider profile will be removed.")) {
            return
        }
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/providers/${id}/reject`, {
                method: "POST",
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Reject failed")
                return
            }
            await load()
        } catch {
            setError("Reject failed")
        } finally {
            setActionId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        Providers
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Review applications and manage verified shops
                    </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
                    {(["pending", "verified", "review", "all"] as const).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-sm rounded-md capitalize ${filter === f
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-600 hover:bg-zinc-50"
                                }`}
                        >
                            {f === "review" ? "needs review" : f}
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
            ) : providers.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                    No providers in this filter.
                </div>
            ) : (
                <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr className="text-left text-zinc-500">
                                <th className="px-4 py-3 font-medium">Business</th>
                                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                                    Owner
                                </th>
                                <th className="px-4 py-3 font-medium hidden md:table-cell">
                                    Location
                                </th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {providers.map((p) => (
                                <tr key={p.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900">
                                            {p.businessName}
                                        </p>
                                        {p.phone && (
                                            <p className="text-xs text-zinc-400">
                                                {p.phone}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <p className="text-zinc-900">
                                            {p.user.name || "—"}
                                        </p>
                                        <p className="text-xs text-zinc-400">
                                            {p.user.email}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell text-zinc-600">
                                        {p.city}
                                        {p.governorate ? `, ${p.governorate}` : ""}
                                        {p.latitude != null && p.longitude != null && (
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="ml-2 text-xs text-zinc-500 underline hover:text-zinc-900"
                                            >
                                                Map
                                            </a>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.isVerified ? (
                                            <span className="inline-flex gap-1.5">
                                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                    Verified
                                                </span>
                                                {p.needsReview && (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                        Needs review
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {p.isVerified && p.needsReview && (
                                            <button
                                                type="button"
                                                disabled={actionId === p.id}
                                                onClick={() => markReviewed(p.id)}
                                                className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                                            >
                                                Mark reviewed
                                            </button>
                                        )}
                                        {!p.isVerified && (
                                            <div className="inline-flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={actionId === p.id}
                                                    onClick={() => approve(p.id)}
                                                    className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actionId === p.id}
                                                    onClick={() => reject(p.id)}
                                                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}