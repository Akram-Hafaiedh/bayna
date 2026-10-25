"use client"

import { useEffect, useState } from "react"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import StatusPill from "@/components/business/StatusPill"
import type { ShopStatusValue } from "@/lib/shop-status"

type ProviderRow = {
    id: string
    name: string
    city: string
    governorate: string | null
    phone: string | null
    status: ShopStatusValue
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
    const [filter, setFilter] = useState<"pending" | "verified" | "suspended" | "review" | "all">("pending")
    const [loading, setLoading] = useState(true)
    const [actionId, setActionId] = useState<string | null>(null)
    const [error, setError] = useState("")
    const confirm = useConfirm()
    const toast = useToast()
    const nameOf = (id: string) => providers.find((p) => p.id === id)?.name ?? "The shop"

    async function load(f = filter) {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(`/api/admin/shops?filter=${f}`)
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
            const res = await fetch(`/api/admin/shops/${id}/approve`, {
                method: "POST",
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Approve failed")
                toast.error("Could not approve", { description: data.error })
                return
            }
            toast.success(`${nameOf(id)} approved`, { description: "The shop owner was notified." })
            await load()
        } catch {
            setError("Approve failed")
        } finally {
            setActionId(null)
        }
    }

    // Suspend or reinstate: the shop stops (or resumes) selling; its owners cannot undo a suspension
    async function setSuspended(id: string, suspend: boolean) {
        const verb = suspend ? "suspend" : "reinstate"
        if (suspend) {
            const yes = await confirm({
                title: `Suspend ${nameOf(id)}?`,
                message: "The shop stops selling and its team cannot open it until you reinstate it. Nothing is deleted.",
                confirmLabel: "Suspend shop",
                tone: "danger",
            })
            if (!yes) return
        }
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/shops/${id}/${verb}`, { method: "POST" })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || `Could not ${verb}`)
                toast.error(`Could not ${verb}`, { description: data.error })
                return
            }
            toast.success(suspend ? `${nameOf(id)} suspended` : `${nameOf(id)} reinstated`)
            await load()
        } catch {
            setError(`Could not ${verb}`)
        } finally {
            setActionId(null)
        }
    }

    async function markReviewed(id: string) {
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/shops/${id}/reviewed`, { method: "POST" })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Could not mark as reviewed")
                toast.error("Could not mark as reviewed", { description: data.error })
                return
            }
            toast.success(`${nameOf(id)} marked as reviewed`, { description: "The shop owner was notified." })
            await load()
        } catch {
            setError("Could not mark as reviewed")
        } finally {
            setActionId(null)
        }
    }

    async function reject(id: string) {
        const yes = await confirm({
            title: `Reject ${nameOf(id)}?`,
            message: "The provider profile will be removed and the applicant will be told it was not approved.",
            confirmLabel: "Reject application",
            tone: "danger",
        })
        if (!yes) return
        setActionId(id)
        try {
            const res = await fetch(`/api/admin/shops/${id}/reject`, {
                method: "POST",
            })
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Reject failed")
                toast.error("Could not reject", { description: data.error })
                return
            }
            toast.success("Application rejected", { description: "The applicant was notified." })
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
                        Shops
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Review applications and manage verified shops
                    </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
                    {(["pending", "verified", "suspended", "review", "all"] as const).map((f) => (
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
                                            {p.name}
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
                                        <span className="inline-flex gap-1.5">
                                            <StatusPill status={p.status} />
                                            {p.status === "ACTIVE" && p.needsReview && (
                                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                    Needs review
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {p.status === "ACTIVE" && (
                                            <button
                                                type="button"
                                                disabled={actionId === p.id}
                                                onClick={() => setSuspended(p.id, true)}
                                                className="mr-3 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                                            >
                                                Suspend
                                            </button>
                                        )}
                                        {p.status === "SUSPENDED" && (
                                            <button
                                                type="button"
                                                disabled={actionId === p.id}
                                                onClick={() => setSuspended(p.id, false)}
                                                className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                                            >
                                                Reinstate
                                            </button>
                                        )}
                                        {p.status === "ACTIVE" && p.needsReview && (
                                            <button
                                                type="button"
                                                disabled={actionId === p.id}
                                                onClick={() => markReviewed(p.id)}
                                                className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                                            >
                                                Mark reviewed
                                            </button>
                                        )}
                                        {p.status === "PENDING" && (
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