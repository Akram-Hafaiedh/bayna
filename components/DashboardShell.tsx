// components/DashboardShell.tsx
import Link from "next/link"
import Navbar from "@/components/Navbar"


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
}: {
    items: { href: string; label: string }[]
}) {
    return (
        <div className="border-b border-zinc-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-11 overflow-x-auto">
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-zinc-50 whitespace-nowrap"
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}