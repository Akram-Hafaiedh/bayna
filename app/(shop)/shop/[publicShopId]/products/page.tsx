import { Suspense } from "react"
import Link from "next/link"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { shopCan } from "@/lib/access/page"
import {
    getFilterCategories,
    getProductStats,
    listProducts,
} from "@/lib/shop-products"
import {
    buildProductsHref,
    hasActiveFilters,
    parseProductFilters,
} from "@/lib/product-filters"
import ProductsToolbar from "@/components/shop/ProductsToolbar"
import ProductsTable from "@/components/shop/ProductsTable"
import Pagination from "@/components/shop/Pagination"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type Params = Promise<{ publicShopId: string }>

export default function ShopProductsPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: SearchParams
}) {
    return (
        <div className="space-y-6">
            <Suspense fallback={<HeaderRow />}>
                <ProductsHeader params={params} />
            </Suspense>

            <Suspense fallback={<ListSkeleton />}>
                <ProductsContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

function HeaderRow({ addHref }: { addHref?: string }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Products
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Manage your catalog, prices and stock
                </p>
            </div>
            {addHref && (
                <Link
                    href={addHref}
                    className="h-10 shrink-0 inline-flex items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Add product
                </Link>
            )}
        </div>
    )
}

async function ProductsHeader({ params }: { params: Params }) {
    const { publicShopId } = await params
    return <HeaderRow addHref={shopPath(publicShopId, "products/new")} />
}

async function ProductsContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { publicShopId } = await params
    const base = shopPath(publicShopId, "")
    const shop = await requireShopPage(publicShopId)
    const filters = parseProductFilters(await searchParams)

    if (!shop) {
        return <Notice>Shop not found.</Notice>
    }
    if (shop.status !== "ACTIVE") {
        return (
            <Notice>
                Your account is not verified yet. Product listing is available once an
                admin approves you.
            </Notice>
        )
    }

    const [result, stats, categories, perms] = await Promise.all([
        listProducts(shop.id, filters),
        getProductStats(shop.id),
        getFilterCategories(shop.id),
        shopCan(shop.id, ["product.price.edit", "product.stock.edit"] as const),
    ])

    if (stats.total === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="font-medium text-zinc-900">No products yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                    Pick items from the shared catalogue or add your own.
                </p>
                <Link
                    href={`${base}/products/new`}
                    className="mt-4 inline-flex h-10 items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                >
                    Add your first product
                </Link>
                {stats.trashed > 0 && (
                    <p className="mt-4 text-sm text-zinc-500">
                        {stats.trashed} removed product{stats.trashed === 1 ? "" : "s"} in the{" "}
                        <Link href={`${base}/products/trash`} className="font-medium text-zinc-900 underline">Trash</Link>
                    </p>
                )}
            </div>
        )
    }

    const chips = [
        {
            label: "Price check needed", count: stats.needsReview, active: filters.review === "yes",
            href: buildProductsHref(filters, { review: filters.review === "yes" ? "all" : "yes" })
        },
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
        {
            label: "Draft", count: stats.draft, active: filters.status === "draft",
            href: buildProductsHref(filters, { status: filters.status === "draft" ? "all" : "draft" })
        },
        {
            label: "Blocked", count: stats.blocked, active: filters.status === "blocked",
            href: buildProductsHref(filters, { status: filters.status === "blocked" ? "all" : "blocked" })
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
                {stats.trashed > 0 && (
                    <Link
                        href={`${base}/products/trash`}
                        className="ml-auto rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-600 hover:border-zinc-300"
                    >
                        Trash · {stats.trashed}
                    </Link>
                )}
            </div>

            {stats.needsReview > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">
                        {stats.needsReview} product{stats.needsReview === 1 ? "" : "s"} need a price check
                    </p>
                    <p className="mt-0.5 text-amber-800">
                        The catalogue changed what {stats.needsReview === 1 ? "this product is" : "these products are"} sold by
                        (for example from piece to box), so the old price may be wrong. Until you confirm the price,
                        {stats.needsReview === 1 ? " it is" : " they are"} left out of comparison.
                    </p>
                    {filters.review !== "yes" && (
                        <Link
                            href={buildProductsHref(filters, { review: "yes" })}
                            className="mt-2 inline-block font-medium underline"
                        >
                            Show them
                        </Link>
                    )}
                </div>
            )}

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
                    <ProductsTable
                        items={result.items}
                        filters={filters}
                        canEditPrice={perms["product.price.edit"]}
                        canEditStock={perms["product.stock.edit"]}
                        shopBase={base}
                    />
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
