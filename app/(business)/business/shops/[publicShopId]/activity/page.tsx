import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/business-auth"
import { prisma } from "@/lib/prisma"
import { effective, has } from "@/lib/access/evaluate"
import { shopPath } from "@/lib/shop-paths"
import ShopActivityFeed from "@/components/access/ShopActivityFeed"

export const metadata: Metadata = { title: "Shop activity" }

// Who changed what in one shop, from the Business area. Same list as the shop's own Activity page.
export default function BusinessShopActivityPage({
    params,
    searchParams,
}: {
    params: Promise<{ publicShopId: string }>
    searchParams: Promise<{ type?: string; page?: string }>
}) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopActivityContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function ShopActivityContent({ params, searchParams }: { params: Promise<{ publicShopId: string }>; searchParams: Promise<{ type?: string; page?: string }> }) {
    const { publicShopId } = await params
    const { business, access } = await requireBusinessArea()

    const shop = await prisma.shop.findFirst({
        where: { publicShopId, businessId: business.id, deletedAt: null },
        select: { id: true },
    })
    if (!shop) notFound()

    const eff = effective(access.assignments, { shopId: shop.id, businessId: business.id })
    if (!has(eff, "activity.log.view")) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The activity history is for owners and managers.</p>
    }

    return (
        <ShopActivityFeed
            shopId={shop.id}
            shopBase={shopPath(publicShopId, "")}
            listPath={`/business/shops/${publicShopId}/activity`}
            searchParams={searchParams}
        />
    )
}
