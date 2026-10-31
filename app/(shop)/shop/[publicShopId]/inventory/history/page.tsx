import { Suspense } from "react"
import Link from "next/link"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { shopCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import { listWarehouses, listMovements } from "@/lib/inventory/warehouses"
import { parseMovementQuery, MOVEMENT_MAX_PAGE_SIZE } from "@/lib/inventory/movement-query"
import { MOVEMENT_LABEL, MOVEMENT_TYPES } from "@/lib/inventory/stock-rules"
import Pager from "@/components/ui/Pager"

type Params = Promise<{ publicShopId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const HISTORY_PAGE_SIZES = [25, 50, 100] as const
const selectClass = "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"

export default function HistoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    return (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
            <Content params={params} searchParams={searchParams} />
        </Suspense>
    )
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

async function Content({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { publicShopId } = await params
    const shop = await requireShopPage(publicShopId)
    const perms = await shopCan(shop.id, ["inventory.movement.view"] as const)
    if (!perms["inventory.movement.view"]) {
        return <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">You do not have access to the stock history.</div>
    }

    const raw = await searchParams
    const sp = new URLSearchParams()
    for (const k of ["warehouse", "product", "type", "from", "to", "page", "pageSize"]) {
        const v = first(raw[k])
        if (v) sp.set(k, v)
    }
    const query = parseMovementQuery(sp)
    if (!(HISTORY_PAGE_SIZES as readonly number[]).includes(query.pageSize)) query.pageSize = 50
    query.pageSize = Math.min(query.pageSize, MOVEMENT_MAX_PAGE_SIZE)

    const warehouses = await listWarehouses(shop.id, { includeArchived: true })
    // Only this shop's own warehouse and product are used as filters
    if (query.warehouseId && !warehouses.some((w) => w.id === query.warehouseId)) query.warehouseId = null
    const product = query.productId
        ? await prisma.product.findFirst({ where: { id: query.productId, shopId: shop.id }, select: { id: true, name: true } })
        : null
    if (!product) query.productId = null

    const result = await listMovements(shop.id, query)
    const base = shopPath(publicShopId, "inventory/history")

    const href = (patch: Record<string, string | number | null>) => {
        const p = new URLSearchParams()
        const current: Record<string, string | number | null> = {
            warehouse: query.warehouseId, product: query.productId, type: query.type,
            from: sp.get("from"), to: sp.get("to"), pageSize: query.pageSize === 50 ? null : query.pageSize,
            page: null, ...patch,
        }
        for (const [k, v] of Object.entries(current)) if (v !== null && v !== "") p.set(k, String(v))
        const s = p.toString()
        return s ? `${base}?${s}` : base
    }
    const filtered = !!(query.warehouseId || query.productId || query.type || query.from || query.to)
    const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" })

    return (
        <div className="space-y-4">
            <form method="get" action={base} className="flex flex-wrap items-center gap-2">
                {product && <input type="hidden" name="product" value={product.id} />}
                <select name="warehouse" defaultValue={query.warehouseId ?? ""} aria-label="Warehouse" className={selectClass}>
                    <option value="">All warehouses</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.archivedAt ? " (archived)" : ""}</option>)}
                </select>
                <select name="type" defaultValue={query.type ?? ""} aria-label="Type" className={selectClass}>
                    <option value="">Every type</option>
                    {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>)}
                </select>
                <label className="flex items-center gap-1 text-sm text-zinc-500">From
                    <input type="date" name="from" defaultValue={sp.get("from") ?? ""} className={selectClass} />
                </label>
                <label className="flex items-center gap-1 text-sm text-zinc-500">To
                    <input type="date" name="to" defaultValue={sp.get("to") ?? ""} className={selectClass} />
                </label>
                <button type="submit" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">Filter</button>
                {filtered && <Link href={base} className="text-sm text-zinc-600 underline">Clear</Link>}
            </form>

            {product && (
                <p className="text-sm text-zinc-600">
                    Only <span className="font-medium text-zinc-900">{product.name}</span>{" "}
                    <Link href={href({ product: null })} className="underline">show all products</Link>
                </p>
            )}

            {result.total === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                    <p className="font-medium text-zinc-900">{filtered ? "No movement matches" : "No stock movements yet"}</p>
                    <p className="mt-1 text-sm text-zinc-500">{filtered ? "Try different filters." : "Every change to your stock will be listed here."}</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                                <tr>
                                    <th scope="col" className="px-4 py-3 font-medium">When</th>
                                    <th scope="col" className="px-4 py-3 font-medium">Product</th>
                                    <th scope="col" className="px-4 py-3 font-medium">Warehouse</th>
                                    <th scope="col" className="px-4 py-3 font-medium">What</th>
                                    <th scope="col" className="px-4 py-3 text-right font-medium">Change</th>
                                    <th scope="col" className="px-4 py-3 text-right font-medium">Then holds</th>
                                    <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                                    <th scope="col" className="px-4 py-3 font-medium">By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {result.items.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{when.format(new Date(m.createdAt))}</td>
                                        <td className="px-4 py-3 text-zinc-900">
                                            <Link href={href({ product: m.product.id })} className="hover:underline">{m.product.name}</Link>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-700">{m.warehouse.name}</td>
                                        <td className="px-4 py-3 text-zinc-700">{MOVEMENT_LABEL[m.type as keyof typeof MOVEMENT_LABEL] ?? m.type}</td>
                                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${m.quantity > 0 ? "text-emerald-700" : "text-red-700"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-zinc-900">{m.balanceAfter}</td>
                                        <td className="px-4 py-3 text-zinc-600">{m.reason ?? ""}</td>
                                        <td className="px-4 py-3 text-zinc-600">{m.by?.name ?? "System"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager
                        page={result.page} pageCount={result.pageCount} total={result.total}
                        pageSize={result.pageSize} pageSizes={HISTORY_PAGE_SIZES}
                        pageHref={(p) => href({ page: p })}
                        sizeHref={(n) => href({ pageSize: n })}
                    />
                </>
            )}
        </div>
    )
}
