import { Suspense } from "react"
import Link from "next/link"
import { requireProvider } from "@/lib/provider-auth"
import {
    getFilterCategories,
    getProductStats,
    listProducts,
} from "@/lib/provider-products"
import {
    buildProductsHref,
    hasActiveFilters,
    parseProductFilters,
} from "@/lib/product-filters"
import ProductsToolbar from "@/components/provider/ProductsToolbar"
import ProductsTable from "@/components/provider/ProductsTable"
import Pagination from "@/components/provider/Pagination"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default function ProviderProductsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        Products
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Manage your catalog, prices and stock
                    </p>
                </div>
                <Link
                    href="/provider/products/new"
                    className="h-10 shrink-0 inline-flex items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Add product
                </Link>
            </div>

            <Suspense fallback={<ListSkeleton />}>
                <ProductsContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function ProductsContent({ searchParams }: { searchParams: SearchParams }) {
    const provider = await requireProvider()
    const filters = parseProductFilters(await searchParams)

    if (!provider) {
        return <Notice>Provider profile not found.</Notice>
    }
    if (!provider.isVerified) {
        return (
            <Notice>
                Your account is not verified yet. Product listing is available once an
                admin approves you.
            </Notice>
        )
    }

    const [result, stats, categories] = await Promise.all([
        listProducts(provider.id, filters),
        getProductStats(provider.id),
        getFilterCategories(provider.id),
    ])

    if (stats.total === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="font-medium text-zinc-900">No products yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                    Pick items from the shared catalogue or add your own.
                </p>
                <Link
                    href="/provider/products/new"
                    className="mt-4 inline-flex h-10 items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Add your first product
                </Link>
            </div>
        )
    }

    const chips = [
        {
            label: "Out of stock", count: stats.outOfStock, active: filters.stock === "out",
            href: buildProductsHref(filters, { stock: filters.stock === "out" ? "all" : "out" })
        },
        {
            label: "Low stock", count: stats.lowStock, active: filters.stock === "low",
            href: buildProductsHref(filters, { stock: filters.stock === "low" ? "all" : "low" })
        },
        {
            label: "Hidden", count: stats.hidden, active: filters.status === "hidden",
            href: buildProductsHref(filters, { status: filters.status === "hidden" ? "all" : "hidden" })
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">{stats.total} products</span>
                {chips
                    .filter((c) => c.count > 0 || c.active)
                    .map((c) => (
                        <Link
                            key={c.label}
                            href={c.href}
                            aria-pressed={c.active}
                            className={`rounded-full border px-3 py-1 ${c.active
                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                                }`}
                        >
                            {c.label} · {c.count}
                        </Link>
                    ))}
            </div>

            <ProductsToolbar filters={filters} categories={categories} />

            {result.total === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                    <p className="font-medium text-zinc-900">No product matches</p>
                    <p className="mt-1 text-sm text-zinc-500">
                        {hasActiveFilters(filters)
                            ? "Try a different search or clear the filters."
                            : "Nothing to show."}
                    </p>
                </div>
            ) : (
                <>
                    <ProductsTable items={result.items} filters={filters} />
                    <Pagination
                        filters={filters}
                        page={result.page}
                        pageCount={result.pageCount}
                        total={result.total}
                    />
                </>
            )}
        </div>
    )
}

function Notice({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {children}
        </div>
    )
}

function ListSkeleton() {
    return (
        <div className="space-y-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200" />
            <div className="h-96 animate-pulse rounded-xl bg-zinc-200" />
        </div>
    )
}
