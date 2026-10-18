"use client"
// components/provider/RestoreButton.tsx
// "Restore" for one product in the trash. Needs product.listing.restore; the server checks it.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import { PRICE_CHECK_NOTE, restoreProduct } from "./restore-product"

export default function RestoreButton({ id, name }: { id: string; name: string }) {
    const router = useRouter()
    const toast = useToast()
    const [busy, setBusy] = useState(false)

    async function restore() {
        setBusy(true)
        const result = await restoreProduct(id)
        setBusy(false)
        if (!result.ok) {
            toast.error("Could not restore", { description: result.error })
            return
        }
        toast.success(`Restored "${name}"`, result.needsPriceReview ? { description: PRICE_CHECK_NOTE } : undefined)
        router.refresh()
    }

    return (
        <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
            {busy ? "Restoring..." : "Restore"}
        </button>
    )
}
