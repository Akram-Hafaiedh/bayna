import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { requireRole } from "@/lib/auth/session"
import { platformCan } from "@/lib/access/page"
import { listSessions } from "@/lib/admin/admin-impersonation"
import { SESSION_PAGE_SIZES, SESSION_STATES, buildSessionsHref, parseSessionQuery } from "@/lib/admin/impersonation-list"
import { Role } from "@/app/generated/prisma/enums"
import SessionsList from "@/components/admin/SessionsList"
import Pager from "@/components/ui/Pager"

export const metadata: Metadata = { title: "View as" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const STATE_LABEL = { all: "All", open: "Open now", ended: "Ended" } as const

export default function AdminImpersonationPage({ searchParams }: { searchParams: SearchParams }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">View as</h1>
                <p className="mt-1 text-sm text-zinc-500">Every time a staff member looked at the app as another person, and why</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <SessionsContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function SessionsContent({ searchParams }: { searchParams: SearchParams }) {
    await connection()
    const me = await requireRole([Role.ADMIN])
    const perms = await platformCan(["impersonation.session.view", "impersonation.session.end_any"] as const)
    if (!perms["impersonation.session.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to this list.</p>
    }

    const query = parseSessionQuery(await searchParams)
    const now = new Date()
    const result = await listSessions(query, now)

    return (
        <>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show">
                {SESSION_STATES.map((s) => (
                    <Link
                        key={s}
                        href={buildSessionsHref(query, { state: s })}
                        role="tab"
                        aria-selected={query.state === s}
                        className={`h-9 rounded-lg border px-3 text-sm font-medium leading-9 ${query.state === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"}`}
                    >
                        {STATE_LABEL[s]}
                    </Link>
                ))}
            </div>

            {result.total === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
                    {query.state === "all" ? "Nobody has used View as yet." : "No sessions match this filter."}
                </div>
            ) : (
                <>
                    <SessionsList sessions={result.items} me={me.id ?? ""} canEnd={perms["impersonation.session.end_any"]} now={now.toISOString()} />
                    <Pager
                        page={result.page}
                        pageCount={result.pageCount}
                        total={result.total}
                        pageSize={result.pageSize}
                        pageSizes={SESSION_PAGE_SIZES}
                        pageHref={(p) => buildSessionsHref(query, { page: p })}
                        sizeHref={(n) => buildSessionsHref(query, { pageSize: n })}
                    />
                </>
            )}
        </>
    )
}
