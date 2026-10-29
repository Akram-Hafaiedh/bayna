import { Suspense } from "react"
import { redirect } from "next/navigation"
import { shopPath } from "@/lib/shop-paths"

// /shop/<publicShopId> on its own opens the shop's dashboard.
export default function ShopRootPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <Suspense fallback={null}>
            <ToDashboard params={params} />
        </Suspense>
    )
}

async function ToDashboard({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    return redirect(shopPath(publicShopId, "dashboard"))
}
