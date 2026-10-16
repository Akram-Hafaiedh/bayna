"use client"
// components/NotificationBell.tsx
// The bell in the header. Shows the number of unread notifications and a dropdown with the latest.
// It checks every 45 seconds while the tab is visible, and again when the tab gets focus.
// When new notifications arrive it also fires a "notifications:new" event on window, so a page that
// shows the same information (for example the shop profile) can refresh itself.
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { timeAgo } from "@/lib/time-ago"

type Item = {
    id: string
    type: string
    title: string
    body: string | null
    href: string | null
    readAt: string | null
    createdAt: string
}

const POLL_MS = 45_000
export const NOTIFICATIONS_NEW_EVENT = "notifications:new"

export default function NotificationBell() {
    const router = useRouter()
    const [items, setItems] = useState<Item[]>([])
    const [unread, setUnread] = useState(0)
    const [open, setOpen] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const lastUnread = useRef<number | null>(null)

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications?limit=15", { cache: "no-store" })
            if (!res.ok) return
            const data = (await res.json()) as { items: Item[]; unreadCount: number }
            setItems(data.items)
            setUnread(data.unreadCount)
            // More unread than last time: something new arrived (not on the very first load)
            if (lastUnread.current !== null && data.unreadCount > lastUnread.current) {
                window.dispatchEvent(new CustomEvent(NOTIFICATIONS_NEW_EVENT))
            }
            lastUnread.current = data.unreadCount
        } catch {
            // offline or the server restarted: try again at the next tick
        } finally {
            setLoaded(true)
        }
    }, [])

    useEffect(() => {
        load()
        const tick = () => {
            if (document.visibilityState === "visible") load()
        }
        const timer = setInterval(tick, POLL_MS)
        document.addEventListener("visibilitychange", tick)
        return () => {
            clearInterval(timer)
            document.removeEventListener("visibilitychange", tick)
        }
    }, [load])

    useEffect(() => {
        function outside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", outside)
        return () => document.removeEventListener("mousedown", outside)
    }, [])

    async function markRead(body: { ids: string[] } | { all: true }) {
        try {
            const res = await fetch("/api/notifications/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (res.ok) {
                const data = (await res.json()) as { unreadCount: number }
                setUnread(data.unreadCount)
                lastUnread.current = data.unreadCount
            }
        } catch {
            // the list is refreshed at the next tick
        }
    }

    function openItem(n: Item) {
        setOpen(false)
        if (!n.readAt) {
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
            markRead({ ids: [n.id] })
        }
        if (n.href) router.push(n.href)
    }

    function markAll() {
        const now = new Date().toISOString()
        setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })))
        markRead({ all: true })
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => {
                    setOpen((v) => !v)
                    if (!open) load()
                }}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                aria-expanded={open}
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
                        <p className="text-sm font-medium text-zinc-900">Notifications</p>
                        {unread > 0 && (
                            <button type="button" onClick={markAll} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {!loaded ? (
                            <p className="px-3.5 py-6 text-center text-sm text-zinc-500">Loading...</p>
                        ) : items.length === 0 ? (
                            <p className="px-3.5 py-6 text-center text-sm text-zinc-500">You have no notifications yet.</p>
                        ) : (
                            <ul className="divide-y divide-zinc-100">
                                {items.map((n) => (
                                    <li key={n.id}>
                                        <button
                                            type="button"
                                            onClick={() => openItem(n)}
                                            className={`flex w-full gap-2.5 px-3.5 py-3 text-left hover:bg-zinc-50 ${n.readAt ? "" : "bg-zinc-50/60"}`}
                                        >
                                            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-blue-600"}`} />
                                            <span className="min-w-0">
                                                <span className={`block text-sm ${n.readAt ? "text-zinc-700" : "font-medium text-zinc-900"}`}>{n.title}</span>
                                                {n.body && <span className="mt-0.5 block text-xs text-zinc-500">{n.body}</span>}
                                                <span className="mt-1 block text-[11px] text-zinc-400">{timeAgo(n.createdAt)}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
