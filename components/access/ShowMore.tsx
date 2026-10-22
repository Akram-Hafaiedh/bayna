"use client"
// components/access/ShowMore.tsx
// The "Show 10 more" button and the small hook behind it, shared by the team and roles lists.
import { useState } from "react"
import { nextCount, takePage } from "@/lib/access/paging"

/** Pages open for a list. They close again (back to one page) whenever `resetKey` changes, e.g. the filters. */
export function useShowMore<T>(items: readonly T[], resetKey: string) {
    const [state, setState] = useState({ key: resetKey, pages: 1 })
    const pages = state.key === resetKey ? state.pages : 1
    return {
        visible: takePage(items, pages),
        remaining: items.length - takePage(items, pages).length,
        next: nextCount(items.length, pages),
        more: () => setState({ key: resetKey, pages: pages + 1 }),
    }
}

export function ShowMore({ next, remaining, onMore, className = "" }: { next: number; remaining: number; onMore: () => void; className?: string }) {
    if (next <= 0) return null
    return (
        <div className={`flex justify-center ${className}`}>
            <button
                type="button"
                onClick={onMore}
                className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            >
                Show {next} more <span className="ml-1.5 text-xs font-normal text-zinc-400">{remaining} hidden</span>
            </button>
        </div>
    )
}
