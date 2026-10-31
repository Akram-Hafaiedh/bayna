import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { inventoryCounts } from "@/lib/inventory/inventory-view"

export default function ShopDashboardPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Shop Dashboard
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
                <ShopStats params={params} />
            </Suspense>
        </div>
    )
}

async function ShopStats({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)

    const live = { deletedAt: null }
    const productCount = shop
        ? await prisma.product.count({ where: { shopId: shop.id, ...live } })
        : 0
    // Low = at or below a reorder point set on the Inventory page; out = nothing left in any warehouse
    const counts = shop ? await inventoryCounts(shop.id) : { products: 0, out: 0, low: 0 }
    const needsReview = shop
        ? await prisma.product.count({
            where: { shopId: shop.id, ...live, needsPriceReview: true },
        })
        : 0

    return (
        <>
            {shop?.status !== "ACTIVE" && (
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Your account is not verified yet. Product listing may be
                    limited until an admin approves you.
                </div>
            )}

            {needsReview > 0 && (
                <Link
                    href={`${shopPath(publicShopId, "products")}?review=yes`}
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
                    href={shopPath(publicShopId, "products")}
                    className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
                >
                    <h3 className="font-medium text-zinc-900">Products</h3>
                    <p className="mt-2 text-3xl font-semibold text-zinc-900">
                        {productCount}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">In your catalog</p>
                </Link>

                <Link
                    href={`${shopPath(publicShopId, "inventory")}?stock=${counts.low > 0 || counts.out === 0 ? "low" : "out"}`}
                    className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
                >
                    <h3 className="font-medium text-zinc-900">Low stock</h3>
                    <p className="mt-2 text-3xl font-semibold text-amber-600">
                        {counts.low}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                        {counts.out > 0 ? `${counts.out} out of stock` : "At or below the reorder point"}
                    </p>
                </Link>

                <div className="rounded-xl border border-zinc-200 bg-white p-5">
                    <h3 className="font-medium text-zinc-900">Orders</h3>
                    <p className="mt-2 text-3xl font-semibold text-zinc-400">0</p>
                    <p className="mt-1 text-sm text-zinc-500">Coming soon</p>
                </div>
            </div>

            {shop?.name && (
                <p className="mt-4 text-sm text-zinc-500">
                    Shop: {shop.name}
                </p>
            )}
        </>
    )
}