import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { shopCan } from "@/lib/access/page"
import ShopActivityFeed from "@/components/access/ShopActivityFeed"

export const metadata: Metadata = { title: "Activity" }

export default function ProviderActivityPage({
    params,
    searchParams,
}: {
    params: Promise<{ publicId: string }>
    searchParams: Promise<{ type?: string; page?: string }>
}) {
    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Activity</h1>
                <p className="mt-1 text-sm text-zinc-500">Who changed what in this shop, newest first.</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ActivityContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function ActivityContent({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ type?: string; page?: string }> }) {
    await connection()
    const { publicId } = await params
    const shop = await requireShopPage(publicId)
    const base = shopPath(publicId, "")
    if (shop?.status !== "ACTIVE") {
        return <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">The activity page opens once your shop is approved.</p>
    }
    const perms = await shopCan(shop.id, ["activity.log.view"] as const)
    if (!perms["activity.log.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The activity history is for owners and managers. Ask one of them if you need to see it.</p>
    }

    return <ShopActivityFeed shopId={shop.id} shopBase={base} listPath={shopPath(publicId, "activity")} searchParams={searchParams} />
}
