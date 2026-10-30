"use client"
// components/account/DeleteAccount.tsx
// "Delete my account" on the profile page. Asks for the password, lists what must be handed over first, and signs
// the person out when the request is accepted. Rules and wording: lib/users/account-deletion.ts.
import { useState } from "react"
import { signOut } from "next-auth/react"
import { GRACE_DAYS } from "@/lib/users/account-deletion"

export default function DeleteAccount() {
    const [open, setOpen] = useState(false)
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [blockers, setBlockers] = useState<string[]>([])

    function close() {
        setOpen(false)
        setPassword("")
        setError("")
        setBlockers([])
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true)
        setError("")
        setBlockers([])
        try {
            const res = await fetch("/api/profile/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Something went wrong")
                setBlockers(Array.isArray(data.blockers) ? data.blockers : [])
                return
            }
            await signOut({ callbackUrl: "/" })
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="rounded-xl border border-red-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Delete account</h2>
            <p className="mt-1 text-sm text-zinc-600">
                Your account is closed now and erased after {GRACE_DAYS} days. Signing in again before then cancels it.
                Your name, email and phone are removed; shops and orders stay, without your name.
            </p>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-4 h-10 px-4 rounded-lg border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50"
            >
                Delete my account
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-900">Delete your account?</h3>
                        <p className="mt-2 text-sm text-zinc-600">
                            You will be signed out everywhere. In {GRACE_DAYS} days your personal data is erased for good. Enter your password to confirm.
                        </p>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            placeholder="Password"
                            className="mt-4 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                        />
                        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                        {blockers.length > 0 && (
                            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700 space-y-1">
                                {blockers.map((b) => <li key={b}>{b}</li>)}
                            </ul>
                        )}
                        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button type="button" onClick={close} className="h-10 px-4 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                                Keep my account
                            </button>
                            <button type="submit" disabled={busy || password.length === 0} className="h-10 px-4 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                                {busy ? "Deleting…" : "Delete my account"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    )
}
