"use client"

import { useEffect, useState } from "react"

type UserRow = {
    id: string
    email: string
    name: string | null
    phone: string | null
    role: string
    createdAt: string
    provider: {
        id: string
        businessName: string
        isVerified: boolean
    } | null
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/admin/users")
                const data = await res.json()
                if (!res.ok) {
                    setError(data.error || "Failed to load")
                    return
                }
                setUsers(data.users || [])
            } catch {
                setError("Failed to load users")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    function roleBadge(role: string) {
        if (role === "ADMIN")
            return "bg-violet-50 text-violet-700"
        if (role === "PROVIDER")
            return "bg-emerald-50 text-emerald-700"
        return "bg-zinc-100 text-zinc-600"
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Users
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    All accounts on the platform
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-zinc-500">Loading...</p>
            ) : users.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                    No users yet.
                </div>
            ) : (
                <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr className="text-left text-zinc-500">
                                <th className="px-4 py-3 font-medium">User</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                                    Provider
                                </th>
                                <th className="px-4 py-3 font-medium hidden md:table-cell">
                                    Joined
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900">
                                            {u.name || "—"}
                                        </p>
                                        <p className="text-xs text-zinc-400">
                                            {u.email}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}
                                        >
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-zinc-600">
                                        {u.provider ? (
                                            <span>
                                                {u.provider.businessName}
                                                {!u.provider.isVerified && (
                                                    <span className="ml-1 text-xs text-amber-600">
                                                        (pending)
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell text-zinc-500">
                                        {new Date(u.createdAt).toLocaleDateString()}
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