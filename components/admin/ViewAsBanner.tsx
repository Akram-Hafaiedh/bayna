"use client"
// components/admin/ViewAsBanner.tsx
// The bar shown on every page while a platform staff member is viewing as another person: who, read-only, the time
// left, and Exit. It reads the session (auth.ts adds `impersonation` to it), so it needs no extra request. When the
// time runs out it closes the session and goes back to the admin area.
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { timeLeft } from "@/lib/impersonation"

export default function ViewAsBanner() {
    const { data: session } = useSession()
    const view = session?.impersonation
    const [now, setNow] = useState<Date | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!view) return
        setNow(new Date())
        const t = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(t)
    }, [view])

    async function exit(to: string) {
        setBusy(true)
        try {
            await fetch("/api/admin/impersonation/end", { method: "POST" })
        } finally {
            window.location.assign(to)
        }
    }

    const expired = !!view && !!now && new Date(view.expiresAt).getTime() <= now.getTime()

    useEffect(() => {
        if (!view) return
        const t = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(t)
    }, [view])

    useEffect(() => {
        if (expired) void exit("/admin/users")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expired])

    if (!view || !now) return null
    return (
        <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-sm text-zinc-900">
            <span>
                <strong>{view.adminName}</strong>, you are viewing as <strong>{view.targetName}</strong>
                {view.mode === "WRITE" ? "" : " (read-only: nothing can be changed)"}
            </span>
            <span className="tabular-nums">{timeLeft(view.expiresAt, now)} left</span>
            <button
                type="button"
                disabled={busy}
                onClick={() => exit("/admin/users")}
                className="h-8 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
                Exit
            </button>
        </div>
    )
}
