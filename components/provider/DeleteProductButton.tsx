"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

export default function DeleteProductButton({ id, name }: { id: string; name: string }) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [, startTransition] = useTransition()

    async function handleDelete() {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
        setBusy(true)
        try {
            const res = await fetch(`/api/provider/products/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                alert(data.error || "Failed to delete product")
                return
            }
            startTransition(() => router.refresh())
        } catch {
            alert("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
        >
            {busy ? "Deleting..." : "Delete"}
        </button>
    )
}
