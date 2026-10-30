// components/access/ShopActivityFeed.tsx
// The activity list of one shop: who changed what, newest first, with a filter by kind and paging. Shared by
// the shop's own Activity page and the shop's Activity tab in the Business area. The page decides who may see
// it (activity.log.view); this only reads and draws.
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { ACTIVITY_KINDS, describeActivity, kindFilter, parseKind } from "@/lib/audit/activity-format"
import { timeAgo } from "@/lib/shared/time-ago"

const PAGE_SIZE = 40

export default async function ShopActivityFeed({
    shopId,
    shopBase,
    listPath,
    searchParams,
}: {
    shopId: string
    /** the shop's address, "/shop/<publicShopId>", so rows can link to what they are about */
    shopBase: string
    /** this list's own address, for the filter and paging links */
    listPath: string
    searchParams: Promise<{ type?: string; page?: string }>
}) {
    const sp = await searchParams
    const kind = parseKind(sp.type)
    const page = Math.max(1, Math.floor(Number(sp.page)) || 1)

    const where: Prisma.ActivityLogWhereInput = { shopId: shopId, ...(kindFilter(kind) as unknown as Prisma.ActivityLogWhereInput) }
    const rows = await prisma.activityLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1, // one extra row tells us whether there is a next page
        select: {
            id: true, createdAt: true, entityType: true, entityId: true, action: true, changes: true, note: true,
            actorName: true, actorRole: true, source: true, onBehalfOfId: true,
        },
    })
    const hasNext = rows.length > PAGE_SIZE
    const shown = rows.slice(0, PAGE_SIZE)
    const href = (p: number, k = kind) => `${listPath}?${new URLSearchParams({ ...(k === "all" ? {} : { type: k }), ...(p > 1 ? { page: String(p) } : {}) })}`
    const link = "inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-300"

    return (
        <>
            <nav aria-label="Filter" className="flex flex-wrap gap-2">
                {ACTIVITY_KINDS.map((k) => (
                    <Link
                        key={k.key}
                        href={href(1, k.key)}
                        className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium ${k.key === kind ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"}`}
                    >
                        {k.label}
                    </Link>
                ))}
            </nav>

            {shown.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-5 py-8 text-center text-sm text-zinc-500">Nothing here yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                    {shown.map((r) => {
                        const line = describeActivity(r, shopBase)
                        const who = r.actorName ?? (r.source === "SYSTEM" ? "System" : "Someone")
                        return (
                            <li key={r.id} className="px-5 py-3.5 text-sm">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <p className="font-medium text-zinc-900">
                                        {line.href ? <Link href={line.href} className="hover:underline underline-offset-2">{line.title}</Link> : line.title}
                                    </p>
                                    <time dateTime={r.createdAt.toISOString()} title={r.createdAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"} className="shrink-0 text-xs text-zinc-400">
                                        {timeAgo(r.createdAt)}
                                    </time>
                                </div>
                                {line.detail && <p className="mt-0.5 break-words text-xs text-zinc-500">{line.detail}</p>}
                                <p className="mt-0.5 text-xs text-zinc-400">
                                    by {who}
                                    {r.actorRole ? ` (${r.actorRole.replace(/shop:|business:/g, "").toLowerCase()})` : ""}
                                    {r.onBehalfOfId ? ", while viewing as this user" : ""}
                                </p>
                            </li>
                        )
                    })}
                </ul>
            )}

            {(page > 1 || hasNext) && (
                <div className="flex items-center justify-between">
                    {page > 1 ? <Link href={href(page - 1)} className={link}>Newer</Link> : <span />}
                    <span className="text-xs text-zinc-400">Page {page}</span>
                    {hasNext ? <Link href={href(page + 1)} className={link}>Older</Link> : <span />}
                </div>
            )}
        </>
    )
}
