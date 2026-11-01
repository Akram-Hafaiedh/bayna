import type { Metadata } from "next"
import { Suspense } from "react"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { shopCan } from "@/lib/access/page"
import { listTaxes } from "@/lib/pricing/taxes"
import { countTaxToSet } from "@/lib/shops/shop-products"
import TaxesManager from "@/components/pricing/TaxesManager"
import TaxesHeader from "@/components/pricing/TaxesHeader"

export const metadata: Metadata = { title: "Taxes" }

type Params = Promise<{ publicShopId: string }>

export default function TaxesPage({ params }: { params: Params }) {
    return (
        <Suspense fallback={<TaxesSkeleton />}>
            <Content params={params} />
        </Suspense>
    )
}

function TaxesSkeleton() {
    return (
        <div className="space-y-6">
            <TaxesHeader />
            <div className="h-64 animate-pulse rounded-xl bg-zinc-200" />
        </div>
    )
}

async function Content({ params }: { params: Params }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    if (shop.status !== "ACTIVE") {
        return (
            <div className="space-y-6">
                <TaxesHeader />
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">Taxes are available once an admin approves your shop.</div>
            </div>
        )
    }
    const [taxes, toSetCount, perms] = await Promise.all([
        listTaxes(shop.id),
        countTaxToSet(shop.id),
        shopCan(shop.id, ["pricing.tax.manage"] as const),
    ])
    return (
        <TaxesManager
            taxes={taxes}
            canManage={perms["pricing.tax.manage"]}
            toSetCount={toSetCount}
            toSetHref={`${shopPath(publicShopId, "products")}?tax=unset`}
        />
    )
}
