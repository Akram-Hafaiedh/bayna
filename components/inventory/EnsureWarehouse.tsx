"use client"
// components/inventory/EnsureWarehouse.tsx
// A shop that has never touched stock has no warehouse yet. Asking the warehouses route makes the default one
// (it needs the signed-in person's permissions, so it cannot happen while the page itself renders).
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { shopFetch } from "@/lib/shops/shop-fetch"

export default function EnsureWarehouse() {
    const router = useRouter()
    const [failed, setFailed] = useState(false)
    useEffect(() => {
        let alive = true
        shopFetch("/api/shop/warehouses")
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (!alive) return
                if (res.ok && Array.isArray(data.warehouses) && data.warehouses.length > 0) router.refresh()
                else setFailed(true)
            })
            .catch(() => alive && setFailed(true))
        return () => { alive = false }
    }, [router])
    return (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            {failed ? "Your first warehouse could not be set up. Reload the page to try again, or ask the shop owner." : "Setting up your first warehouse..."}
        </div>
    )
}
