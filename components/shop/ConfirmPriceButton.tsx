"use client"
// components/shop/ConfirmPriceButton.tsx
// "Keep this price": tells the server the shop has checked the price after a catalogue change.
// Needs product.price.edit; the server checks it.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shop-fetch"

export default function ConfirmPriceButton({ productId, className = "" }: { productId: string; className?: string }) {
    const router = useRouter()
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    async function confirmPrice() {
        setBusy(true)
        setError("")
        try {
            const res = await shopFetch(`/api/shop/products/${productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmPrice: true }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not confirm")
                return
            }
            toast.success("Price confirmed", { description: "It is back in comparison." })
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <span className={className}>
            <button
                type="button"
                onClick={confirmPrice}
                disabled={busy}
                className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
                {busy ? "Confirming..." : "Keep this price"}
            </button>
            {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
        </span>
    )
}
