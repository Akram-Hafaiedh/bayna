import { Suspense } from "react"
import Navbar from "@/components/Navbar"
import ShopSwitcherLoader from "@/components/shop/ShopSwitcherLoader"
import { SubNav } from "@/components/DashboardShell"
import { shopPath } from "@/lib/shop-paths"

type Params = Promise<{ publicShopId: string }>

export default function ShopLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Params
}) {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <Suspense fallback={<div className="h-11 border-b border-zinc-200 bg-white" />}>
                <ShopSubNav params={params} />
            </Suspense>
            <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </div>
    )
}

// The links need the shop's public id, which is only known at request time, so they sit in their own Suspense.
async function ShopSubNav({ params }: { params: Params }) {
    const { publicShopId } = await params
    return (
        <SubNav
            leading={<ShopSwitcherLoader publicShopId={publicShopId} />}
            items={[
                { href: shopPath(publicShopId, "dashboard"), label: "Overview" },
                { href: shopPath(publicShopId, "products"), label: "Products" },
            ]}
        />
    )
}
