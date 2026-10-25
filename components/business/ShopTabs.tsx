"use client"
// components/business/ShopTabs.tsx
// The tabs of one shop in the Business area: details, team, roles and activity. They live in the shop's
// layout, so switching tabs only swaps the content below; the header and the tabs themselves stay put.
// The active tab comes from the route segment the layout is showing. Team and roles are managed for live
// shops only; the activity of a shop that is not live yet (its approval, for example) can still be read.
import Link from "next/link"
import { useSelectedLayoutSegment } from "next/navigation"

export default function ShopTabs({ publicId, live }: { publicId: string; live: boolean }) {
    const segment = useSelectedLayoutSegment() // null = the details page, otherwise the folder name
    const base = `/business/shops/${publicId}`
    const tabs = [
        { key: "details", label: "Details", href: base, active: segment === null },
        ...(live
            ? [
                { key: "team", label: "Team", href: `${base}/team`, active: segment === "team" },
                { key: "roles", label: "Roles", href: `${base}/roles`, active: segment === "roles" },
            ]
            : []),
        { key: "activity", label: "Activity", href: `${base}/activity`, active: segment === "activity" },
    ]
    return (
        <nav aria-label="Shop sections" className="flex flex-wrap gap-x-1 border-b border-zinc-200">
            {tabs.map((t) => (
                <Link
                    key={t.key}
                    href={t.href}
                    aria-current={t.active ? "page" : undefined}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${t.active ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
                >
                    {t.label}
                </Link>
            ))}
        </nav>
    )
}
