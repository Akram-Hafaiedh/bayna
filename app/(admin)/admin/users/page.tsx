import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { platformCan } from "@/lib/access/page"
import { listUsers } from "@/lib/admin-users"
import { buildUsersHref, hasUserFilters, parseUserQuery, USER_PAGE_SIZES } from "@/lib/user-list"
import { Role } from "@/app/generated/prisma/enums"
import UsersList from "@/components/admin/UsersList"
import UsersToolbar from "@/components/admin/UsersToolbar"
import Pager from "@/components/ui/Pager"

export const metadata: Metadata = { title: "Users" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Users</h1>
                <p className="mt-1 text-sm text-zinc-500">All accounts on the platform</p>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <UsersContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function UsersContent({ searchParams }: { searchParams: SearchParams }) {
    await connection()
    const me = await requireRole([Role.ADMIN])
    const perms = await platformCan(["user.account.view", "impersonation.session.start_readonly"] as const)
    if (!perms["user.account.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to the user list.</p>
    }

    const query = parseUserQuery(await searchParams)
    const result = await listUsers(query)

    return (
        <>
            <UsersToolbar query={query} />

            {result.total === 0 && !hasUserFilters(query) ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">No users yet.</div>
            ) : (
                <>
                    <UsersList users={result.items} me={me.id ?? ""} canViewAs={perms["impersonation.session.start_readonly"]} />
                    <Pager
                        page={result.page}
                        pageCount={result.pageCount}
                        total={result.total}
                        pageSize={result.pageSize}
                        pageSizes={USER_PAGE_SIZES}
                        pageHref={(p) => buildUsersHref(query, { page: p })}
                        sizeHref={(n) => buildUsersHref(query, { pageSize: n })}
                    />
                </>
            )}
        </>
    )
}
