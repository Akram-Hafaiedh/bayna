import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { Role } from "@/app/generated/prisma/enums"

export default function AdminDashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Admin Dashboard
            </h1>
            <p className="mt-2 text-zinc-500">
                Manage users, providers, and platform settings.
            </p>

            <Suspense
                fallback={
                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
                        <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
                        <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
                    </div>
                }
            >
                <AdminStats />
            </Suspense>
        </div>
    )
}

async function AdminStats() {
    await connection()
    await requireRole([Role.ADMIN])

    const [pendingProviders, totalUsers, verifiedProviders] = await Promise.all([
        prisma.provider.count({ where: { isVerified: false } }),
        prisma.user.count(),
        prisma.provider.count({ where: { isVerified: true } }),
    ])

    return (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
                href="/admin/providers"
                className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
            >
                <h3 className="font-medium text-zinc-900">Pending providers</h3>
                <p className="mt-2 text-3xl font-semibold text-amber-600">
                    {pendingProviders}
                </p>
                <p className="mt-1 text-sm text-zinc-500">Waiting for approval</p>
            </Link>

            <Link
                href="/admin/users"
                className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
            >
                <h3 className="font-medium text-zinc-900">Total users</h3>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {totalUsers}
                </p>
                <p className="mt-1 text-sm text-zinc-500">All accounts</p>
            </Link>

            <Link
                href="/admin/providers"
                className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
            >
                <h3 className="font-medium text-zinc-900">Verified providers</h3>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">
                    {verifiedProviders}
                </p>
                <p className="mt-1 text-sm text-zinc-500">Active shops</p>
            </Link>
        </div>
    )
}