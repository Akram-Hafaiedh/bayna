import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { platformCan } from "@/lib/access/page"
import { prisma } from "@/lib/prisma"
import { Role } from "@/app/generated/prisma/enums"
import {
    CONTACT_PAGE_SIZES, CONTACT_STATUSES, CONTACT_STATUS_LABEL, buildContactHref, parseContactQuery, replyHref, topicLabel,
    type ContactStatusValue,
} from "@/lib/contact"
import { timeAgo } from "@/lib/time-ago"
import MessageActions from "@/components/admin/MessageActions"
import Pager from "@/components/ui/Pager"

export const metadata: Metadata = { title: "Messages" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const BADGE: Record<ContactStatusValue, string> = {
    NEW: "bg-blue-50 text-blue-700 border-blue-100",
    READ: "bg-zinc-100 text-zinc-700 border-zinc-200",
    HANDLED: "bg-emerald-50 text-emerald-700 border-emerald-100",
}

export default function AdminMessagesPage({ searchParams }: { searchParams: SearchParams }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Messages</h1>
                <p className="mt-1 text-sm text-zinc-500">Sent from the Contact page</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <MessagesContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function MessagesContent({ searchParams }: { searchParams: SearchParams }) {
    await connection()
    await requireRole([Role.ADMIN])
    const perms = await platformCan(["support.ticket.view_all", "support.ticket.change_status"] as const)
    if (!perms["support.ticket.view_all"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the messages.</p>
    }
    const canChange = perms["support.ticket.change_status"]

    const query = parseContactQuery(await searchParams)
    const where = query.status === "all" ? {} : { status: query.status }
    const [grouped, total, items] = await Promise.all([
        prisma.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.contactMessage.count({ where }),
        prisma.contactMessage.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            select: { id: true, name: true, email: true, topic: true, message: true, status: true, createdAt: true, userId: true },
        }),
    ])
    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Partial<Record<ContactStatusValue, number>>
    const all = grouped.reduce((n, g) => n + g._count._all, 0)
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
    const now = new Date()

    const tabs: { key: "all" | ContactStatusValue; label: string; count: number }[] = [
        ...CONTACT_STATUSES.map((s) => ({ key: s, label: CONTACT_STATUS_LABEL[s], count: counts[s] ?? 0 })),
        { key: "all" as const, label: "All", count: all },
    ]

    return (
        <>
            <nav className="flex flex-wrap gap-2" aria-label="Filter messages">
                {tabs.map((t) => {
                    const on = query.status === t.key
                    return (
                        <Link
                            key={t.key}
                            href={buildContactHref(query, { status: t.key })}
                            aria-current={on ? "page" : undefined}
                            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"}`}
                        >
                            {t.label}
                            <span className={`text-xs tabular-nums ${on ? "text-zinc-300" : "text-zinc-400"}`}>{t.count}</span>
                        </Link>
                    )
                })}
            </nav>

            {total === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                    {query.status === "NEW" ? "No new messages." : "No messages here."}
                </div>
            ) : (
                <>
                    <ul className="space-y-3">
                        {items.map((m) => (
                            <li key={m.id} className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-zinc-900">{m.name} <span className="font-normal text-zinc-500">&lt;{m.email}&gt;</span></p>
                                        <p className="mt-0.5 text-xs text-zinc-500">
                                            {topicLabel(m.topic)} &middot; <time dateTime={m.createdAt.toISOString()} title={m.createdAt.toLocaleString()}>{timeAgo(m.createdAt, now)}</time>
                                            {m.userId && <> &middot; signed in</>}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE[m.status]}`}>{CONTACT_STATUS_LABEL[m.status]}</span>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800">{m.message}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <a href={replyHref(m)} className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-800">Reply by email</a>
                                    {canChange && <MessageActions id={m.id} status={m.status} />}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <Pager
                        page={query.page}
                        pageCount={pageCount}
                        total={total}
                        pageSize={query.pageSize}
                        pageSizes={CONTACT_PAGE_SIZES}
                        pageHref={(p) => buildContactHref(query, { page: p })}
                        sizeHref={(n) => buildContactHref(query, { pageSize: n })}
                    />
                </>
            )}
        </>
    )
}
