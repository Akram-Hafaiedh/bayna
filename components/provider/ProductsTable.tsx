import Link from "next/link"
import type { ProductRow } from "@/lib/provider-products"
import {
    buildProductsHref,
    defaultDir,
    LOW_STOCK_THRESHOLD,
    type ProductFilters,
    type SortKey,
} from "@/lib/product-filters"
import { UNIT_LABELS } from "@/lib/units"
import DeleteProductButton from "./DeleteProductButton"

function SortHeader({
    label,
    sortKey,
    filters,
    className = "",
}: {
    label: string
    sortKey: SortKey
    filters: ProductFilters
    className?: string
}) {
    const active = filters.sort === sortKey
    const nextDir = active ? (filters.dir === "asc" ? "desc" : "asc") : defaultDir(sortKey)
    return (
        <th
            scope="col"
            aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}
            className={`px-4 py-3 font-medium ${className}`}
        >
            <Link
                href={buildProductsHref(filters, { sort: sortKey, dir: nextDir })}
                className={`inline-flex items-center gap-1 hover:text-zinc-900 ${active ? "text-zinc-900" : ""}`}
            >
                {label}
                <span aria-hidden className="text-xs">
                    {active ? (filters.dir === "asc" ? "↑" : "↓") : ""}
                </span>
            </Link>
        </th>
    )
}

export default function ProductsTable({
    items,
    filters,
}: {
    items: ProductRow[]
    filters: ProductFilters
}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                    <tr>
                        <SortHeader label="Product" sortKey="name" filters={filters} />
                        <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                            Category
                        </th>
                        <SortHeader label="Price" sortKey="price" filters={filters} />
                        <SortHeader label="Stock" sortKey="stock" filters={filters} />
                        <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
                            Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {items.map((p) => {
                        const out = p.stock <= 0
                        const low = !out && p.stock < LOW_STOCK_THRESHOLD
                        return (
                            <tr key={p.id} className="hover:bg-zinc-50/60">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-900">{p.name}</span>
                                        {p.catalogItemId && (
                                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                                                Catalogue
                                            </span>
                                        )}
                                    </div>
                                    {(p.brand || p.sku) && (
                                        <div className="mt-0.5 text-xs text-zinc-400">
                                            {[p.brand, p.sku].filter(Boolean).join(" · ")}
                                        </div>
                                    )}
                                </td>
                                <td className="hidden px-4 py-3 text-zinc-500 lg:table-cell">
                                    {p.category?.name ?? "—"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-zinc-900">
                                    {Number(p.price).toFixed(3)} TND
                                    <span className="text-xs text-zinc-400"> / {UNIT_LABELS[p.unit]}</span>
                                    {p.minOrderQty && (
                                        <div className="text-xs text-zinc-400">min. {p.minOrderQty}</div>
                                    )}
                                </td>
                                <td
                                    className={`whitespace-nowrap px-4 py-3 ${out
                                            ? "font-medium text-red-600"
                                            : low
                                                ? "font-medium text-amber-600"
                                                : "text-zinc-700"
                                        }`}
                                >
                                    {out ? "Out of stock" : p.stock}
                                </td>
                                <td className="hidden px-4 py-3 md:table-cell">
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs ${p.isActive
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-zinc-100 text-zinc-500"
                                            }`}
                                    >
                                        {p.isActive ? "Active" : "Hidden"}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-4">
                                        <Link
                                            href={`/provider/products/${p.id}/edit`}
                                            className="text-sm text-zinc-600 hover:text-zinc-900"
                                        >
                                            Edit
                                        </Link>
                                        <DeleteProductButton id={p.id} name={p.name} />
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
