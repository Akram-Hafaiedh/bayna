import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireShopPage } from "@/lib/shops/shop-auth"
import { shopPath } from "@/lib/shops/shop-paths"
import { listPriceHistory, PRICE_HISTORY_LIMIT } from "@/lib/pricing/price-history"
import { PRICE_REASON_LABEL, type PriceChange } from "@/lib/pricing/price-history-rules"
import { UNIT_LABELS } from "@/lib/catalogue/units"
import { timeAgo } from "@/lib/shared/time-ago"
import type { Unit } from "@/app/generated/prisma/enums"

export const metadata: Metadata = { title: "Price history" }

type Params = Promise<{ publicShopId: string; id: string }>

export default function PriceHistoryPage({ params }: { params: Params }) {
    return (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
            <Content params={params} />
        </Suspense>
    )
}

function ChangeText({ change }: { change: PriceChange }) {
    if (change.direction === "first") return <span className="text-zinc-400">first price</span>
    if (change.direction === "same") return <span className="text-zinc-400">no change</span>
    const up = change.direction === "up"
    return <span className={up ? "text-red-600" : "text-emerald-700"}>{up ? "+" : "-"} {change.amount}</span>
}

async function Content({ params }: { params: Params }) {
    const { publicShopId, id } = await params
    const shop = await requireShopPage(publicShopId)
    if (shop.status !== "ACTIVE") notFound()
    const history = await listPriceHistory(shop.id, id)
    if (!history) notFound()
    const { product, rows, total } = history

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Price history</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        {product.name} <span className="text-zinc-400">/ {UNIT_LABELS[product.unit as Unit]}</span>. Every change of its price before tax, or of its price with tax, in TND.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                    <Link href={`${shopPath(publicShopId, "products")}/${product.id}/edit`} className="text-sm text-zinc-600 hover:text-zinc-900">Edit product</Link>
                    <Link href={shopPath(publicShopId, "products")} className="text-sm text-zinc-600 hover:text-zinc-900">Back to products</Link>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                    <p className="font-medium text-zinc-900">No history yet</p>
                    <p className="mt-1 text-sm text-zinc-500">The next change of this product&apos;s price will show here.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-medium">When</th>
                                <th scope="col" className="px-4 py-3 font-medium">Price before tax</th>
                                <th scope="col" className="px-4 py-3 font-medium">Price with tax</th>
                                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">What changed</th>
                                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-zinc-50/60">
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700" title={new Date(r.at).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"}>{timeAgo(r.at)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-900">
                                        <span className="tabular-nums">{r.price}</span>
                                        <div className="text-xs"><ChangeText change={r.change} /></div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-900">
                                        <span className="tabular-nums">{r.priceTtc}</span>
                                        <div className="text-xs"><ChangeText change={r.changeTtc} /></div>
                                    </td>
                                    <td className="hidden px-4 py-3 md:table-cell">
                                        <span className={`rounded-full px-2 py-0.5 text-xs ${r.reason === "PRICE" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{PRICE_REASON_LABEL[r.reason]}</span>
                                    </td>
                                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell">{r.by?.name ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {total > PRICE_HISTORY_LIMIT && (
                <p className="text-sm text-zinc-500">Showing the latest {PRICE_HISTORY_LIMIT} of {total} changes.</p>
            )}
        </div>
    )
}
