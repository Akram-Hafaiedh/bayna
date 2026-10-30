"use client"
// components/business/use-shop-actions.ts
// What a person can click on a shop from the Business area: open it, or move it along its life
// (send for approval, close, reopen). The server checks every one of them again.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { shopPath } from "@/lib/shops/shop-paths"
import type { ShopAction } from "@/lib/shops/shop-status"

const COPY: Partial<Record<ShopAction, { title: (n: string) => string; message: string; confirm: string; done: string; danger?: boolean }>> = {
    submit: {
        title: (n) => `Send ${n} for approval?`,
        message: "An administrator will check it before it goes live.",
        confirm: "Send",
        done: "Sent for approval",
    },
    close: {
        title: (n) => `Close ${n}?`,
        message: "The shop stops selling and cannot be opened until you reopen it. Nothing is deleted.",
        confirm: "Close shop",
        done: "Shop closed",
        danger: true,
    },
    reopen: {
        title: (n) => `Reopen ${n}?`,
        message: "The shop goes live again.",
        confirm: "Reopen",
        done: "Shop reopened",
    },
}

export function useShopActions() {
    const router = useRouter()
    const toast = useToast()
    const confirm = useConfirm()
    const [busy, setBusy] = useState<string | null>(null)

    async function open(shop: { id: string; publicShopId: string; name: string }) {
        setBusy(shop.id)
        try {
            const res = await fetch("/api/me/active-shop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopId: shop.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not open the shop", { description: data.error })
                return
            }
            toast.success(`Now working in ${shop.name}`)
            router.push(shopPath(shop.publicShopId, "dashboard"))
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    async function move(shop: { id: string; publicShopId: string; name: string }, action: "submit" | "close" | "reopen") {
        const copy = COPY[action]!
        const ok = await confirm({
            title: copy.title(shop.name),
            message: copy.message,
            confirmLabel: copy.confirm,
            tone: copy.danger ? "danger" : "default",
        })
        if (!ok) return
        setBusy(shop.id)
        try {
            const res = await fetch(`/api/business/shops/${shop.publicShopId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not change the shop", { description: data.error })
                return
            }
            toast.success(copy.done)
            router.refresh()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setBusy(null)
        }
    }

    return { busy, open, move }
}
