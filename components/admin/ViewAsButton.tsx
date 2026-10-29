"use client"
// components/admin/ViewAsButton.tsx
// "View as" on the admin user page: asks for a reason and the staff member's password, then opens the app as that
// person (read-only). The route checks the permission and the rules again.
import { useState } from "react"
import { REASON_MAX } from "@/lib/impersonation"

export default function ViewAsButton({ publicUserId, name }: { publicUserId: string; name: string }) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState("")
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    function close() {
        setOpen(false)
        setReason("")
        setPassword("")
        setError("")
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true)
        setError("")
        try {
            const res = await fetch("/api/admin/impersonation/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: publicUserId, reason, password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Something went wrong")
                return
            }
            // A full load, so the page is drawn for the viewed person from the first byte
            window.location.assign(data.redirect ?? "/")
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:border-zinc-300"
            >
                View as {name}
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-900">View as {name}?</h3>
                        <p className="mt-2 text-sm text-zinc-600">
                            You will see the app exactly as they do, for 30 minutes. You can only look: nothing can be changed.
                            They are told that support looked at their account, and your reason is kept in the activity log.
                        </p>
                        <label className="mt-4 block text-sm font-medium text-zinc-900" htmlFor="view-as-reason">Reason</label>
                        <textarea
                            id="view-as-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={REASON_MAX}
                            rows={3}
                            placeholder="For example: customer says their orders page is empty"
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                        />
                        <label className="mt-3 block text-sm font-medium text-zinc-900" htmlFor="view-as-password">Your password</label>
                        <input
                            id="view-as-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                        />
                        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={close} className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
                            <button type="submit" disabled={busy || reason.trim().length === 0 || password.length === 0} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                                {busy ? "Opening…" : "Start viewing"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    )
}
