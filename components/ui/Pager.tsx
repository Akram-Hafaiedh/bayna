// components/ui/Pager.tsx
// "Showing 1-25 of 140", page numbers and a page size, for lists that live in the address (Server
// Component, plain links). The page decides what the links look like, so any list can use it.
import Link from "next/link"

/** 1 … 4 5 6 … 12 : first, last and the neighbours of the current page. */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
    const wanted = new Set([1, pageCount, page - 1, page, page + 1])
    const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
    const out: (number | "gap")[] = []
    pages.forEach((p, i) => {
        if (i > 0 && p - pages[i - 1] > 1) out.push("gap")
        out.push(p)
    })
    return out
}

export default function Pager({
    page,
    pageCount,
    total,
    pageSize,
    pageSizes,
    pageHref,
    sizeHref,
}: {
    page: number
    pageCount: number
    total: number
    pageSize: number
    pageSizes: readonly number[]
    pageHref: (page: number) => string
    sizeHref: (size: number) => string
}) {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
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
                    <Link href={pageHref(page - 1)} className={idle}>Previous</Link>
                ) : (
                    <span className={disabled}>Previous</span>
                )}
                {pageWindow(page, pageCount).map((p, i) =>
                    p === "gap" ? (
                        <span key={`gap-${i}`} className="px-1 text-zinc-400">…</span>
                    ) : (
                        <Link
                            key={p}
                            href={pageHref(p)}
                            aria-current={p === page ? "page" : undefined}
                            className={p === page ? `${base} border-zinc-900 bg-zinc-900 text-white` : idle}
                        >
                            {p}
                        </Link>
                    )
                )}
                {page < pageCount ? (
                    <Link href={pageHref(page + 1)} className={idle}>Next</Link>
                ) : (
                    <span className={disabled}>Next</span>
                )}
            </nav>

            <p className="flex items-center gap-2">
                Per page
                {pageSizes.map((n) => (
                    <Link key={n} href={sizeHref(n)} className={n === pageSize ? "font-medium text-zinc-900" : "hover:text-zinc-900"}>
                        {n}
                    </Link>
                ))}
            </p>
        </div>
    )
}
