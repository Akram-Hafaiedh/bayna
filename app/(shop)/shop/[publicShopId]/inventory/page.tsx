import { Suspense } from "react"
import Link from "next/link"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { shopCan } from "@/lib/access/page"
import { listWarehouses } from "@/lib/inventory/warehouses"
import { listInventory, inventoryCounts } from "@/lib/inventory/inventory-view"
import { buildInventoryHref, hasInventoryFilters, INVENTORY_PAGE_SIZES, parseInventoryQuery } from "@/lib/inventory/inventory-query"
import InventoryTable from "@/components/inventory/InventoryTable"
import EnsureWarehouse from "@/components/inventory/EnsureWarehouse"
import Pager from "@/components/ui/Pager"

type Params = Promise<{ publicShopId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default function InventoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    return (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
            <Content params={params} searchParams={searchParams} />
        </Suspense>
    )
}

const selectClass = "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"

async function Content({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    if (shop.status !== "ACTIVE") {
        return <Notice>Inventory is available once an admin approves your shop.</Notice>
    }
    const base = shopPath(publicShopId, "inventory")
    const query = parseInventoryQuery(await searchParams)

    const warehouses = await listWarehouses(shop.id)
    if (warehouses.length === 0) return <EnsureWarehouse />
    // A warehouse that is not one of this shop's live ones is ignored rather than trusted
    const picked = warehouses.find((w) => w.id === query.warehouseId)?.id ?? null
    const q = { ...query, warehouseId: picked }

    const [result, counts, perms] = await Promise.all([
        listInventory(shop.id, q),
        inventoryCounts(shop.id),
        shopCan(shop.id, ["inventory.adjustment.create", "inventory.transfer.create"] as const),
    ])

    if (counts.products === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="font-medium text-zinc-900">No products yet</p>
                <p className="mt-1 text-sm text-zinc-500">Add products first, then manage their stock here.</p>
                <Link href={shopPath(publicShopId, "products/new")} className="mt-4 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                    Add your first product
                </Link>
            </div>
        )
    }

    const chips = [
        { label: "Out of stock", count: counts.out, active: q.stock === "out", href: buildInventoryHref(base, q, { stock: q.stock === "out" ? "all" : "out" }) },
        { label: "Low stock", count: counts.low, active: q.stock === "low", href: buildInventoryHref(base, q, { stock: q.stock === "low" ? "all" : "low" }) },
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">{counts.products} products · {warehouses.length} {warehouses.length === 1 ? "warehouse" : "warehouses"}</span>
                {chips.filter((c) => c.count > 0 || c.active).map((c) => (
                    <Link
                        key={c.label} href={c.href} aria-pressed={c.active}
                        className={`rounded-full border px-3 py-1 ${c.active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"}`}
                    >
                        {c.label} · {c.count}
                    </Link>
                ))}
            </div>

            {/* A plain GET form: the filters live in the address, no script needed */}
            <form method="get" action={base} className="flex flex-wrap items-center gap-2">
                <input type="search" name="q" defaultValue={q.q} placeholder="Search name, brand or SKU" aria-label="Search products" className={`${selectClass} w-full sm:w-64`} />
                {warehouses.length > 1 && (
                    <select name="warehouse" defaultValue={picked ?? ""} aria-label="Warehouse" className={selectClass}>
                        <option value="">All warehouses</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                )}
                <select name="stock" defaultValue={q.stock} aria-label="Stock level" className={selectClass}>
                    <option value="all">Any stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                </select>
                <button type="submit" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">Filter</button>
                {hasInventoryFilters(q) && <Link href={base} className="text-sm text-zinc-600 underline">Clear</Link>}
            </form>

            {q.stock === "low" && (
                <p className="text-xs text-zinc-500">Low means at or below the reorder point you set for a product in a warehouse (open Manage, then Low-stock alert).</p>
            )}

            {result.total === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                    <p className="font-medium text-zinc-900">No product matches</p>
                    <p className="mt-1 text-sm text-zinc-500">Try a different search or clear the filters.</p>
                </div>
            ) : (
                <>
                    <InventoryTable
                        items={result.items}
                        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
                        selectedWarehouseId={picked}
                        canAdjust={perms["inventory.adjustment.create"]}
                        canTransfer={perms["inventory.transfer.create"]}
                    />
                    <Pager
                        page={result.page} pageCount={result.pageCount} total={result.total}
                        pageSize={result.pageSize} pageSizes={INVENTORY_PAGE_SIZES}
                        pageHref={(p) => buildInventoryHref(base, q, { page: p })}
                        sizeHref={(n) => buildInventoryHref(base, q, { pageSize: n })}
                    />
                </>
            )}
        </div>
    )
}

function Notice({ children }: { children: React.ReactNode }) {
    return <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{children}</div>
}
