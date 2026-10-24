import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { requireShopPage } from "@/lib/shop-auth"
import { shopPath } from "@/lib/shop-paths"
import { shopCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { ACTIVITY_KINDS, describeActivity, kindFilter, parseKind } from "@/lib/activity-format"
import { timeAgo } from "@/lib/time-ago"

export const metadata: Metadata = { title: "Activity" }

const PAGE_SIZE = 40

export default function ProviderActivityPage({
    params,
    searchParams,
}: {
    params: Promise<{ publicId: string }>
    searchParams: Promise<{ type?: string; page?: string }>
}) {
    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Activity</h1>
                <p className="mt-1 text-sm text-zinc-500">Who changed what in this shop, newest first.</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ActivityContent params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function ActivityContent({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ type?: string; page?: string }> }) {
    await connection()
    const { publicId } = await params
    const shop = await requireShopPage(publicId)
    const base = shopPath(publicId, "")
    if (!shop?.isVerified) {
        return <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">The activity page opens once your shop is approved.</p>
    }
    const perms = await shopCan(shop.id, ["activity.log.view"] as const)
    if (!perms["activity.log.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The activity history is for owners and managers. Ask one of them if you need to see it.</p>
    }

    const sp = await searchParams
    const kind = parseKind(sp.type)
    const page = Math.max(1, Math.floor(Number(sp.page)) || 1)

    const where: Prisma.ActivityLogWhereInput = { providerId: shop.id, ...(kindFilter(kind) as unknown as Prisma.ActivityLogWhereInput) }
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
    const href = (p: number, k = kind) => `${shopPath(publicId, "activity")}?${new URLSearchParams({ ...(k === "all" ? {} : { type: k }), ...(p > 1 ? { page: String(p) } : {}) })}`
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
                        const line = describeActivity(r, base)
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
