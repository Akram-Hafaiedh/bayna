import Link from "next/link"
import {
    buildProductsHref,
    PAGE_SIZES,
    type ProductFilters,
} from "@/lib/product-filters"

/** 1 … 4 5 6 … 12 : first, last and the neighbours of the current page. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
    const wanted = new Set([1, pageCount, page - 1, page, page + 1])
    const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
    const out: (number | "gap")[] = []
    pages.forEach((p, i) => {
        if (i > 0 && p - pages[i - 1] > 1) out.push("gap")
        out.push(p)
    })
    return out
}

export default function Pagination({
    filters,
    page,
    pageCount,
    total,
}: {
    filters: ProductFilters
    page: number
    pageCount: number
    total: number
}) {
    const from = total === 0 ? 0 : (page - 1) * filters.pageSize + 1
    const to = Math.min(page * filters.pageSize, total)
    const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm"
    const idle = `${base} border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300`
    const disabled = `${base} border-zinc-100 bg-zinc-50 text-zinc-300`

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
            <p>
                Showing {from}–{to} of {total}
            </p>

            <nav aria-label="Pagination" className="flex items-center gap-1">
                {page > 1 ? (
                    <Link href={buildProductsHref(filters, { page: page - 1 })} className={idle}>
                        Previous
                    </Link>
                ) : (
                    <span className={disabled}>Previous</span>
                )}

                {pageWindow(page, pageCount).map((p, i) =>
                    p === "gap" ? (
                        <span key={`gap-${i}`} className="px-1 text-zinc-400">
                            …
                        </span>
                    ) : (
                        <Link
                            key={p}
                            href={buildProductsHref(filters, { page: p })}
                            aria-current={p === page ? "page" : undefined}
                            className={
                                p === page
                                    ? `${base} border-zinc-900 bg-zinc-900 text-white`
                                    : idle
                            }
                        >
                            {p}
                        </Link>
                    )
                )}

                {page < pageCount ? (
                    <Link href={buildProductsHref(filters, { page: page + 1 })} className={idle}>
                        Next
                    </Link>
                ) : (
                    <span className={disabled}>Next</span>
                )}
            </nav>

            <p className="flex items-center gap-2">
                Per page
                {PAGE_SIZES.map((n) => (
                    <Link
                        key={n}
                        href={buildProductsHref(filters, { pageSize: n })}
                        className={n === filters.pageSize ? "font-medium text-zinc-900" : "hover:text-zinc-900"}
                    >
                        {n}
                    </Link>
                ))}
            </p>
        </div>
    )
}
