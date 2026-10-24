"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { PRICE_CHECK_NOTE, restoreProduct } from "./restore-product"
import { shopFetch } from "@/lib/shop-fetch"

export default function DeleteProductButton({ id, name }: { id: string; name: string }) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    const [, startTransition] = useTransition()

    async function undo() {
        const result = await restoreProduct(id)
        if (!result.ok) {
            toast.error("Could not undo", { description: result.error })
            return
        }
        toast.success(`Restored "${name}"`, result.needsPriceReview ? { description: PRICE_CHECK_NOTE } : undefined)
        startTransition(() => router.refresh())
    }

    async function handleDelete() {
        const yes = await confirm({
            title: `Move "${name}" to trash?`,
            message: "It disappears from your list and from search. You can restore it from the Trash at any time.",
            confirmLabel: "Move to trash",
            tone: "danger",
        })
        if (!yes) return

        setBusy(true)
        try {
            const res = await shopFetch(`/api/provider/products/${id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not remove the product", { description: data.error })
                return
            }
            toast.success(`"${name}" moved to trash`, data.canRestore ? { action: { label: "Undo", onClick: undo } } : undefined)
            startTransition(() => router.refresh())
        } catch {
            toast.error("Something went wrong", { description: "The product was not removed." })
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
            {busy ? "Removing..." : "Delete"}
        </button>
    )
}
