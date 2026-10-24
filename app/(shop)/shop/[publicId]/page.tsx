import { Suspense } from "react"
import { redirect } from "next/navigation"
import { shopPath } from "@/lib/shop-paths"

// /shop/<publicId> on its own opens the shop's dashboard.
export default function ShopRootPage({ params }: { params: Promise<{ publicId: string }> }) {
    return (
        <Suspense fallback={null}>
            <ToDashboard params={params} />
        </Suspense>
    )
}

async function ToDashboard({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params
    return redirect(shopPath(publicId, "dashboard"))
}
