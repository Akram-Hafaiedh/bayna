"use client"
// components/business/ShopsList.tsx
// The shops of a business as a list: place, status, products, team, setup progress and one "..." menu
// per row. Search and status filter appear once there are enough shops to need them; ten rows at a
// time. The server page decides who may do what and passes it in; the routes check again.
import { useMemo, useState } from "react"
import Link from "next/link"
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { ShowMore, useShowMore } from "@/components/access/ShowMore"
import StatusPill from "@/components/business/StatusPill"
import { useShopActions } from "@/components/business/use-shop-actions"
import { countByStatus, filterShops, NO_SHOP_FILTERS, type ShopFilters, type ShopRow } from "@/lib/shop-list"
import { SHOP_STATUSES, SHOP_STATUS_LABEL, type ShopStatusValue } from "@/lib/shop-status"

// With a handful of shops a search box is noise; it appears from this many on
const FILTER_FROM = 5

const inputClass =
    "h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"

export default function ShopsList({ shops, canChangeStatus }: { shops: ShopRow[]; canChangeStatus: boolean }) {
    const { busy, open, move } = useShopActions()
    const [filters, setFilters] = useState<ShopFilters>(NO_SHOP_FILTERS)
    const shown = useMemo(() => filterShops(shops, filters), [shops, filters])
    const page = useShowMore(shown, JSON.stringify(filters))
    const counts = useMemo(() => countByStatus(shops), [shops])
    const filterActive = filters.q.trim() !== "" || filters.status !== "all"

    if (shops.length === 0) {
        return <p className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500">No shops yet.</p>
    }

    function menuFor(s: ShopRow): RowMenuItem[] {
        const items: RowMenuItem[] = [{ label: "Edit", href: `/business/shops/${s.publicId}` }]
        // Teams are managed for live shops, from the Business area
        if (s.status === "ACTIVE") items.push({ label: "Team", href: `/business/shops/${s.publicId}/team` })
        if (s.openable) items.push({ label: "Open shop", onClick: () => void open(s) })
        if (canChangeStatus) {
            if (s.status === "DRAFT") items.push({ label: "Send for approval", onClick: () => void move(s, "submit") })
            if (s.status === "ACTIVE") items.push({ label: "Close shop", onClick: () => void move(s, "close"), danger: true })
            if (s.status === "CLOSED") items.push({ label: "Reopen shop", onClick: () => void move(s, "reopen") })
        }
        return items
    }

    return (
        <section className="rounded-xl border border-zinc-200 bg-white">
            {shops.length >= FILTER_FROM && (
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
                    <input
                        type="search"
                        value={filters.q}
                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                        placeholder="Search by name or place"
                        aria-label="Search shops"
                        className={`${inputClass} min-w-0 flex-1 sm:max-w-xs`}
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value as ShopFilters["status"] })}
                        aria-label="Filter by status"
                        className={inputClass}
                    >
                        <option value="all">All statuses</option>
                        {SHOP_STATUSES.filter((s: ShopStatusValue) => counts[s]).map((s) => (
                            <option key={s} value={s}>
                                {SHOP_STATUS_LABEL[s]} ({counts[s]})
                            </option>
                        ))}
                    </select>
                    {filterActive && (
                        <button type="button" onClick={() => setFilters(NO_SHOP_FILTERS)} className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                            Clear
                        </button>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                        <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                            <th className="px-4 py-2.5 font-medium">Shop</th>
                            <th className="px-3 py-2.5 font-medium">Status</th>
                            <th className="px-3 py-2.5 text-right font-medium">Products</th>
                            <th className="px-3 py-2.5 text-right font-medium">Team</th>
                            <th className="px-3 py-2.5 font-medium">Setup</th>
                            <th className="w-12 px-4 py-2.5"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {page.visible.map((s) => {
                            const complete = s.setupDone === s.setupTotal
                            return (
                                <tr key={s.id} className="align-middle">
                                    <td className="px-4 py-3">
                                        <Link href={`/business/shops/${s.publicId}`} className="block max-w-[18rem] truncate font-medium text-zinc-900 hover:underline">
                                            {s.name}
                                        </Link>
                                        <p className="text-xs text-zinc-500">{[s.city, s.governorate].filter(Boolean).join(", ")}</p>
                                    </td>
                                    <td className="px-3 py-3"><StatusPill status={s.status} /></td>
                                    <td className="px-3 py-3 text-right tabular-nums text-zinc-700">{s.products}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-zinc-700">{s.team}</td>
                                    <td className="px-3 py-3">
                                        <span className={`tabular-nums ${complete ? "text-zinc-500" : "font-medium text-amber-700"}`}>
                                            {s.setupDone}/{s.setupTotal}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end">
                                            <RowMenu label={`Actions for ${s.name}`} items={menuFor(s)} disabled={busy === s.id} />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {shown.length === 0 && <p className="px-5 py-6 text-center text-sm text-zinc-500">No shop matches these filters.</p>}
            <ShowMore next={page.next} remaining={page.remaining} onMore={page.more} className="border-t border-zinc-100 py-3" />
        </section>
    )
}
