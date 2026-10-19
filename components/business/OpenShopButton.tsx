"use client"
// components/business/OpenShopButton.tsx
// Switches the active shop and opens its dashboard. The server checks the person works in that shop.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"

export default function OpenShopButton({ shopId, shopName }: { shopId: string; shopName: string }) {
    const router = useRouter()
    const toast = useToast()
    const [busy, setBusy] = useState(false)

    async function open() {
        setBusy(true)
        try {
            const res = await fetch("/api/me/active-shop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ providerId: shopId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not open the shop", { description: data.error })
                return
            }
            toast.success(`Now working in ${shopName}`)
            router.push("/provider/dashboard")
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    return (
        <button
            onClick={() => void open()}
            disabled={busy}
            className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
            {busy ? "Opening..." : "Open shop"}
        </button>
    )
}
