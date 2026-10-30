import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireBusinessArea } from "@/lib/businesses/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import { actionsFor } from "@/lib/shops/shop-status"
import ShopActionsMenu from "@/components/business/ShopActionsMenu"
import ShopTabs from "@/components/business/ShopTabs"
import StatusPill from "@/components/business/StatusPill"

// The shop's own header and tabs, shared by its pages (Details, Team). A layout stays mounted while the
// person moves between those pages, so only the content below changes.
export default function BusinessShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-zinc-200" />}>
                <ShopHeader params={params} />
            </Suspense>
            {children}
        </div>
    )
}

async function ShopHeader({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    const { business, access } = await requireBusinessArea()

    // Found by its public id, and only inside the business the person is working in
    const shop = await prisma.shop.findFirst({
        where: { publicShopId, businessId: business.id, deletedAt: null },
        select: { id: true, name: true, status: true },
    })
    if (!shop) notFound()

    const perms = await businessCan(business.id, ["business.shop.change_status"] as const)
    const moves = perms["business.shop.change_status"] ? actionsFor(shop.status, "owner") : []
    const canOpen = shop.status === "ACTIVE" && (access.businessShops[business.id] ?? []).includes(shop.id)

    return (
        <div>
            <Link href="/business/shops" className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                All shops of {business.name}
            </Link>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-zinc-900">{shop.name}</h1>
                <div className="flex items-center gap-2">
                    <StatusPill status={shop.status} />
                    {(canOpen || moves.length > 0) && (
                        <ShopActionsMenu
                            shopId={shop.id}
                            shopPublicId={publicShopId}
                            shopName={shop.name}
                            canOpen={canOpen}
                            moves={moves.map((m) => m.action as "submit" | "close" | "reopen")}
                        />
                    )}
                </div>
            </div>
            <div className="mt-4">
                <ShopTabs publicShopId={publicShopId} live={shop.status === "ACTIVE"} />
            </div>
        </div>
    )
}
