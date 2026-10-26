"use client"
// components/admin/UsersToolbar.tsx
// Search and filters of the Users list. They live in the address (?q=&role=&status=), so a filtered list can
// be shared and the back button works; typing waits a moment before it asks the server.
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { buildUsersHref, hasUserFilters, NO_USER_QUERY, USER_ROLES, type UserQuery } from "@/lib/user-list"
import { USER_STATUSES, USER_STATUS_LABEL } from "@/lib/user-status"

const field =
    "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"

export default function UsersToolbar({ query }: { query: UserQuery }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()

    // Local text so typing stays instant; the address is updated after a pause
    const [q, setQ] = useState(query.q)
    const [prevUrlQ, setPrevUrlQ] = useState(query.q)
    const [pushedQ, setPushedQ] = useState(query.q)
    if (query.q !== prevUrlQ) {
        // the address changed: if it was not our own push (back / forward), follow it
        setPrevUrlQ(query.q)
        if (query.q !== pushedQ) {
            setQ(query.q)
            setPushedQ(query.q)
        }
    }

    function go(overrides: Partial<UserQuery>) {
        startTransition(() => {
            router.replace(buildUsersHref(query, overrides), { scroll: false })
        })
    }

    useEffect(() => {
        const next = q.trim()
        if (next === query.q) return
        const timer = setTimeout(() => {
            setPushedQ(next)
            startTransition(() => {
                router.replace(buildUsersHref(query, { q: next }), { scroll: false })
            })
        }, 300)
        return () => clearTimeout(timer)
    }, [q, query, router])

    return (
        <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
            <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, phone or shop"
                aria-label="Search users"
                className={`${field} w-full sm:w-80`}
            />
            <select aria-label="Role" value={query.role} onChange={(e) => go({ role: e.target.value as UserQuery["role"] })} className={field}>
                <option value="all">All roles</option>
                {USER_ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                ))}
            </select>
            <select aria-label="Status" value={query.status} onChange={(e) => go({ status: e.target.value as UserQuery["status"] })} className={field}>
                <option value="all">All statuses</option>
                {USER_STATUSES.map((s) => (
                    <option key={s} value={s}>{USER_STATUS_LABEL[s]}</option>
                ))}
            </select>
            {hasUserFilters(query) && (
                <button
                    type="button"
                    onClick={() => {
                        setQ("")
                        setPushedQ("")
                        router.replace(buildUsersHref(NO_USER_QUERY), { scroll: false })
                    }}
                    className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
                >
                    Clear
                </button>
            )}
        </div>
    )
}
