import { Suspense } from "react"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { shopCan } from "@/lib/access/page"
import { listWarehouses } from "@/lib/inventory/warehouses"
import WarehousesManager from "@/components/inventory/WarehousesManager"
import EnsureWarehouse from "@/components/inventory/EnsureWarehouse"

type Params = Promise<{ publicShopId: string }>

export default function WarehousesPage({ params }: { params: Params }) {
    return (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-200" />}>
            <Content params={params} />
        </Suspense>
    )
}

async function Content({ params }: { params: Params }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    if (shop.status !== "ACTIVE") {
        return <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">Warehouses are available once an admin approves your shop.</div>
    }
    const [warehouses, perms] = await Promise.all([
        listWarehouses(shop.id, { includeArchived: true }),
        shopCan(shop.id, ["inventory.location.manage"] as const),
    ])
    if (warehouses.length === 0) return <EnsureWarehouse />
    return (
        <WarehousesManager
            warehouses={warehouses}
            historyBase={shopPath(publicShopId, "inventory/history")}
            canManage={perms["inventory.location.manage"]}
        />
    )
}
