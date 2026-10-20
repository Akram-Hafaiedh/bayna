// components/DashboardShell.tsx
import Navbar from "@/components/Navbar"
import SubNavLink from "@/components/SubNavLink"


export function ContentSkeleton() {
    return (
        <div>
            <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
                <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
                <div className="h-28 animate-pulse rounded-xl bg-zinc-200" />
            </div>
        </div>
    )
}


export function DashboardLoading() {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 py-8"><ContentSkeleton /></div>
        </div>
    )
}

export function SubNav({
    items,
    leading,
}: {
    items: { href: string; label: string }[]
    /** Shown before the links (the shop switcher). Kept outside the scrolling links so its menu is not clipped. */
    leading?: React.ReactNode
}) {
    return (
        <div className="border-b border-zinc-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 flex items-center h-11">
                {leading && <div className="mr-2 shrink-0 border-r border-zinc-200 pr-3">{leading}</div>}
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {items.map((item) => (
                        <SubNavLink key={item.href} href={item.href} label={item.label} />
                    ))}
                </div>
            </div>
        </div>
    )
}
