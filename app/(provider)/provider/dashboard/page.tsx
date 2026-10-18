import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { requireProvider } from "@/lib/provider-auth"

export default function ProviderDashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Provider Dashboard
            </h1>
            <p className="mt-2 text-zinc-500">
                Manage your products, stock, and orders.
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
                <ProviderStats />
            </Suspense>
        </div>
    )
}

async function ProviderStats() {

    const provider = await requireProvider()

    const live = { deletedAt: null }
    const productCount = provider
        ? await prisma.product.count({ where: { providerId: provider.id, ...live } })
        : 0
    const lowStock = provider
        ? await prisma.product.count({
            where: { providerId: provider.id, ...live, stock: { lt: 5 } },
        })
        : 0
    const needsReview = provider
        ? await prisma.product.count({
            where: { providerId: provider.id, ...live, needsPriceReview: true },
        })
        : 0

    return (
        <>
            {!provider?.isVerified && (
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Your account is not verified yet. Product listing may be
                    limited until an admin approves you.
                </div>
            )}

            {needsReview > 0 && (
                <Link
                    href="/provider/products?review=yes"
                    className="mt-4 block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
                >
                    <span className="font-medium">
                        {needsReview} product{needsReview === 1 ? " needs" : "s need"} a price check.
                    </span>{" "}
                    A catalogue item changed its unit, so the old price may be wrong. Review them.
                </Link>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                    href="/provider/products"
                    className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
                >
                    <h3 className="font-medium text-zinc-900">Products</h3>
                    <p className="mt-2 text-3xl font-semibold text-zinc-900">
                        {productCount}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">In your catalog</p>
                </Link>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Low stock</h3>
                    <p className="mt-2 text-3xl font-semibold text-amber-600">
                        {lowStock}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">Under 5 units</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Orders</h3>
                    <p className="mt-2 text-3xl font-semibold text-zinc-400">0</p>
                    <p className="mt-1 text-sm text-zinc-500">Coming soon</p>
                </div>
            </div>

            {provider?.businessName && (
                <p className="mt-4 text-sm text-zinc-500">
                    Shop: {provider.businessName}
                </p>
            )}
        </>
    )
}