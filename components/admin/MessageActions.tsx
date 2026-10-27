"use client"

// The buttons on one contact message: mark as read, handled or new again.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import { contactMoves, type ContactStatusValue } from "@/lib/contact"

export default function MessageActions({ id, status }: { id: string; status: ContactStatusValue }) {
    const router = useRouter()
    const toast = useToast()
    const [busy, setBusy] = useState(false)

    async function move(to: ContactStatusValue) {
        setBusy(true)
        try {
            const res = await fetch(`/api/admin/messages/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: to }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not update the message", { description: data.error })
                return
            }
            router.refresh()
        } catch {
            toast.error("Could not update the message", { description: "Check your connection and try again." })
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            {contactMoves(status).map((m) => (
                <button
                    key={m.to}
                    type="button"
                    disabled={busy}
                    onClick={() => move(m.to)}
                    className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 disabled:opacity-50"
                >
                    {m.label}
                </button>
            ))}
        </>
    )
}
