"use client"
// components/InviteAccept.tsx
// The button on an invitation page. Three situations: not signed in (go sign in or register and come
// back), signed in with the wrong address (say so), signed in with the right one (accept).
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useToast } from "@/components/ui/Toast"

export default function InviteAccept({
    token,
    inviteEmail,
    signedInEmail,
}: {
    token: string
    inviteEmail: string
    signedInEmail: string | null
}) {
    const router = useRouter()
    const toast = useToast()
    const { update } = useSession()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const back = `/invite/${token}`
    const btn = "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium"

    if (!signedInEmail) {
        return (
            <div className="flex flex-wrap gap-3 pt-2">
                <Link href={`/login?next=${encodeURIComponent(back)}&email=${encodeURIComponent(inviteEmail)}`} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}>
                    Sign in
                </Link>
                <Link href={`/register?next=${encodeURIComponent(back)}&email=${encodeURIComponent(inviteEmail)}`} className={`${btn} border border-zinc-300 text-zinc-800 hover:bg-zinc-50`}>
                    Create an account
                </Link>
                <p className="w-full text-xs text-zinc-500">Use the address {inviteEmail}: the invitation only works for it.</p>
            </div>
        )
    }

    if (signedInEmail !== inviteEmail) {
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                    You are signed in as {signedInEmail}, but this invitation was sent to {inviteEmail}.
                </div>
                <button
                    onClick={() => void signOut({ callbackUrl: `/login?next=${encodeURIComponent(back)}&email=${encodeURIComponent(inviteEmail)}` })}
                    className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}
                >
                    Sign out and use {inviteEmail}
                </button>
            </div>
        )
    }

    async function accept() {
        setError("")
        setBusy(true)
        try {
            const res = await fetch("/api/invites/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not accept the invitation")
                return
            }
            // Open the shop they were invited to (the server checks they really work there)
            if (data.shopId) {
                await fetch("/api/me/active-shop", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ providerId: data.shopId }),
                }).catch(() => undefined)
            }
            // The account type may have changed (client to provider): refresh the sign-in before moving on
            await update()
            toast.success(`You joined ${data.where}`, { description: `Your role: ${data.role}` })
            router.push("/shop")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-3 pt-2">
            {error && (
                <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    {error}
                </div>
            )}
            <button onClick={() => void accept()} disabled={busy} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50`}>
                {busy ? "Joining..." : "Accept invitation"}
            </button>
        </div>
    )
}
