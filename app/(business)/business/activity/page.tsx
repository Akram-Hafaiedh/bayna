import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { requireBusinessArea } from "@/lib/business-auth"
import { businessCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import { describeActivity } from "@/lib/activity-format"
import { timeAgo } from "@/lib/time-ago"

export const metadata: Metadata = { title: "Activity" }

const PAGE_SIZE = 40

export default function BusinessActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    return (
        <div className="max-w-3xl space-y-6">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <ActivityContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function ActivityContent({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const { business } = await requireBusinessArea()
    const perms = await businessCan(business.id, ["activity.log.view"] as const)
    const head = (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Activity</h1>
            <p className="mt-1 text-sm text-zinc-500">Business and team changes across {business.name} and its shops, newest first.</p>
        </div>
    )
    if (!perms["activity.log.view"]) {
        return (
            <>
                {head}
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">The activity history is for business owners and managers.</p>
            </>
        )
    }

    const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1)

    // Business-level rows carry no shop id, so they are found by what they are about
    const [shops, invites, assignments] = await Promise.all([
        prisma.shop.findMany({ where: { businessId: business.id }, select: { id: true } }),
        prisma.accessInvite.findMany({ where: { businessId: business.id }, select: { id: true } }),
        prisma.accessAssignment.findMany({ where: { businessId: business.id }, select: { id: true } }),
    ])
    const rows = await prisma.activityLog.findMany({
        where: {
            OR: [
                { entityType: "Business", entityId: business.id },
                { entityType: "AccessInvite", entityId: { in: invites.map((i) => i.id) }, action: { startsWith: "TEAM_" } },
                { entityType: "AccessAssignment", entityId: { in: assignments.map((a) => a.id) }, action: { startsWith: "TEAM_" } },
                { shopId: { in: shops.map((s) => s.id) }, action: { startsWith: "TEAM_" } },
            ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
        select: {
            id: true, createdAt: true, entityType: true, entityId: true, action: true, changes: true, note: true,
            actorName: true, actorRole: true, source: true,
        },
    })
    const hasNext = rows.length > PAGE_SIZE
    const shown = rows.slice(0, PAGE_SIZE)
    const link = "inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-300"

    return (
        <>
            {head}
            {shown.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-5 py-8 text-center text-sm text-zinc-500">Nothing here yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                    {shown.map((r) => {
                        const line = describeActivity(r)
                        return (
                            <li key={r.id} className="px-5 py-3.5 text-sm">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <p className="font-medium text-zinc-900">
                                        {line.href ? <Link href={line.href} className="underline-offset-2 hover:underline">{line.title}</Link> : line.title}
                                    </p>
                                    <time dateTime={r.createdAt.toISOString()} className="shrink-0 text-xs text-zinc-400">{timeAgo(r.createdAt)}</time>
                                </div>
                                {line.detail && <p className="mt-0.5 break-words text-xs text-zinc-500">{line.detail}</p>}
                                <p className="mt-0.5 text-xs text-zinc-400">by {r.actorName ?? (r.source === "SYSTEM" ? "System" : "Someone")}</p>
                            </li>
                        )
                    })}
                </ul>
            )}
            {(page > 1 || hasNext) && (
                <div className="flex items-center justify-between">
                    {page > 1 ? <Link href={`/business/activity?page=${page - 1}`} className={link}>Newer</Link> : <span />}
                    <span className="text-xs text-zinc-400">Page {page}</span>
                    {hasNext ? <Link href={`/business/activity?page=${page + 1}`} className={link}>Older</Link> : <span />}
                </div>
            )}
        </>
    )
}
