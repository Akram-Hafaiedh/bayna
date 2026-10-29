import { Suspense } from "react"
import Link from "next/link"
import type { Metadata } from "next"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { shopCan } from "@/lib/access/page"
import { listTrash, TRASH_LIMIT } from "@/lib/provider-products"
import { UNIT_LABELS } from "@/lib/units"
import { timeAgo } from "@/lib/time-ago"
import RestoreButton from "@/components/shop/RestoreButton"

export const metadata: Metadata = { title: "Trash" }

export default function ProviderTrashPage({ params }: { params: Promise<{ publicShopId: string }> }) {
    return (
        <div className="space-y-6">
            <div>
                <Suspense fallback={<span className="text-sm text-zinc-500">← Products</span>}>
                    <BackToProducts params={params} />
                </Suspense>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Trash</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Removed products. They are hidden from your list and from search, and kept so past orders stay readable.
                </p>
            </div>
            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-200" />}>
                <TrashContent params={params} />
            </Suspense>
        </div>
    )
}

async function BackToProducts({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    return (
        <Link href={shopPath(publicShopId, "products")} className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Products
        </Link>
    )
}

async function TrashContent({ params }: { params: Promise<{ publicShopId: string }> }) {
    const { publicShopId } = await params
    const provider = await requireShopPage(publicShopId)
    if (!provider) {
        return <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">Shop not found.</p>
    }

    const [{ items, total }, perms] = await Promise.all([
        listTrash(provider.id),
        shopCan(provider.id, ["product.listing.restore"] as const),
    ])
    const canRestore = perms["product.listing.restore"]

    if (total === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="font-medium text-zinc-900">The trash is empty</p>
                <p className="mt-1 text-sm text-zinc-500">Products you delete show up here, so you can bring them back.</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {!canRestore && (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    You can see removed products but not restore them. Ask the owner or a manager.
                </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                        <tr>
                            <th scope="col" className="px-4 py-3 font-medium">Product</th>
                            <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Price</th>
                            <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Removed</th>
                            <th scope="col" className="px-4 py-3 text-right font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {items.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-50/60">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-900">{p.name}</span>
                                        {p.catalogItemId && (
                                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">Catalogue</span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-zinc-400">
                                        {[p.brand, p.sku, p.category?.name].filter(Boolean).join(" · ") || "—"}
                                    </p>
                                </td>
                                <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                                    {Number(p.price).toFixed(3)} TND <span className="text-zinc-400">/ {UNIT_LABELS[p.unit]}</span>
                                    <p className="text-xs text-zinc-400">Stock {p.stock}</p>
                                </td>
                                <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                                    {timeAgo(p.deletedAt)}
                                    {p.deletedByName && <p className="text-xs text-zinc-400">by {p.deletedByName}</p>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {canRestore && <RestoreButton id={p.id} name={p.name} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {total > TRASH_LIMIT && (
                <p className="text-sm text-zinc-500">Showing the {TRASH_LIMIT} most recently removed of {total}.</p>
            )}
        </div>
    )
}