"use client"
// components/access/RolesList.tsx
// The roles of a shop or a business as a list with search and filters. A row opens the role on its own
// page (edit or view); Clone opens the new-role page filled in; Delete asks first. The server page
// decides what this person may do (`editable`, `newHref`); the routes check everything again.
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { ShowMore, useShowMore } from "@/components/access/ShowMore"
import { NO_FILTERS, accessLabel, filterRoles, holdsEverything, isFiltered, roleModules, type RoleFilters, type RoleListItem } from "@/lib/access/role-list"

const selectClass = "h-9 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
const ghostBtn =
    "inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"

const MAX_CHIPS = 5

export default function RolesList({
    items,
    basePath,
    canCreate,
    emptyHint,
}: {
    items: RoleListItem[]
    /** where the role pages live, for example "/shop/abc/roles": a role opens at `${basePath}/<id>`, new ones at `${basePath}/new`.
     *  A string, not functions: a server page cannot pass functions to a client component. */
    basePath: string
    /** this person may create roles somewhere here (shows New role and Clone) */
    canCreate: boolean
    emptyHint?: string
}) {
    const openHref = (id: string) => `${basePath}/${id}`
    const cloneHref = (id: string) => `${basePath}/new?clone=${id}`
    const newHref = canCreate ? `${basePath}/new` : null
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [filters, setFilters] = useState<RoleFilters>(NO_FILTERS)
    const [busy, setBusy] = useState<string | null>(null)
    const set = <K extends keyof RoleFilters>(key: K, value: RoleFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))

    const owners = useMemo(() => {
        const seen = new Map<string, RoleListItem["owner"]>()
        for (const r of items) if (!seen.has(r.owner.id)) seen.set(r.owner.id, r.owner)
        return [...seen.values()]
    }, [items])
    const shown = useMemo(() => filterRoles(items, filters), [items, filters])
    const page = useShowMore(shown, JSON.stringify(filters))

    async function remove(r: RoleListItem) {
        const ok = await confirm({
            title: `Delete the role "${r.name}"?`,
            message: "This cannot be undone. A role that people still hold cannot be deleted.",
            confirmLabel: "Delete",
            tone: "danger",
        })
        if (!ok) return
        setBusy(r.id)
        try {
            const res = await fetch(`/api/provider/roles/${r.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not delete the role", { description: data.error })
                return
            }
            toast.success("Role deleted")
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    value={filters.q}
                    onChange={(e) => set("q", e.target.value)}
                    placeholder="Search roles or modules"
                    aria-label="Search roles"
                    className="h-9 min-w-48 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                {owners.length > 1 && (
                    <select aria-label="Belongs to" className={selectClass} value={filters.owner} onChange={(e) => set("owner", e.target.value)}>
                        <option value="all">All places</option>
                        {owners.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.scope === "BUSINESS" ? `Business: ${o.name}` : o.name}
                            </option>
                        ))}
                    </select>
                )}
                <select aria-label="Access level" className={selectClass} value={filters.access} onChange={(e) => set("access", e.target.value as RoleFilters["access"])}>
                    <option value="all">Any access</option>
                    <option value="everything">Everything</option>
                    <option value="limited">Limited</option>
                </select>
                <select aria-label="Use" className={selectClass} value={filters.usage} onChange={(e) => set("usage", e.target.value as RoleFilters["usage"])}>
                    <option value="all">Used or not</option>
                    <option value="used">In use</option>
                    <option value="unused">Not used</option>
                </select>
                <select aria-label="Sort by" className={selectClass} value={filters.sort} onChange={(e) => set("sort", e.target.value as RoleFilters["sort"])}>
                    <option value="name">Sort: name</option>
                    <option value="people">Sort: most people</option>
                    <option value="access">Sort: most access</option>
                </select>
                {newHref && (
                    <Link href={newHref} className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                        New role
                    </Link>
                )}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                    {shown.length === items.length ? `${items.length} ${items.length === 1 ? "role" : "roles"}` : `${shown.length} of ${items.length} roles`}
                </span>
                {isFiltered(filters) && (
                    <button type="button" className="underline underline-offset-2 hover:text-zinc-900" onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}>
                        Clear filters
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-5 py-8 text-center text-sm text-zinc-500">
                    No roles yet.{newHref ? " Create the first one." : ""} {emptyHint}
                </p>
            ) : shown.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-5 py-8 text-center text-sm text-zinc-500">No role matches these filters.</p>
            ) : (
                <>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                    {page.visible.map((r) => {
                        const modules = holdsEverything(r.permissions) ? [] : roleModules(r.permissions)
                        return (
                            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 py-4">
                                <div className="min-w-0 flex-1 basis-72">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link href={openHref(r.id)} className="text-sm font-semibold text-zinc-900 hover:underline">
                                            {r.name}
                                        </Link>
                                        {holdsEverything(r.permissions) && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">Everything</span>}
                                        {owners.length > 1 && (
                                            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600">
                                                {r.owner.scope === "BUSINESS" ? "Business" : r.owner.name}
                                            </span>
                                        )}
                                    </div>
                                    {r.description && <p className="mt-0.5 text-xs text-zinc-500">{r.description}</p>}
                                    {modules.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {modules.slice(0, MAX_CHIPS).map((m) => (
                                                <span key={m} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{m}</span>
                                            ))}
                                            {modules.length > MAX_CHIPS && <span className="px-1 py-0.5 text-[11px] text-zinc-400">+{modules.length - MAX_CHIPS} more</span>}
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs text-zinc-400">{accessLabel(r.permissions)}</p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                    <p className="text-xs text-zinc-500">
                                        {r.members} {r.members === 1 ? "person" : "people"}
                                        {r.invites > 0 ? ` · ${r.invites} ${r.invites === 1 ? "invitation" : "invitations"} waiting` : ""}
                                    </p>
                                    <div className="flex gap-2">
                                        <Link href={openHref(r.id)} className={ghostBtn}>
                                            {r.editable ? "Edit" : "View"}
                                        </Link>
                                        {newHref && r.editable && (
                                            <Link href={cloneHref(r.id)} className={ghostBtn}>
                                                Clone
                                            </Link>
                                        )}
                                        {r.editable && (
                                            <button type="button" className={ghostBtn} disabled={busy === r.id || r.members + r.invites > 0} title={r.members + r.invites > 0 ? "People or invitations still use this role" : undefined} onClick={() => void remove(r)}>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
                <ShowMore next={page.next} remaining={page.remaining} onMore={page.more} />
                </>
            )}
        </section>
    )
}
