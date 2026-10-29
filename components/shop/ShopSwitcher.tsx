"use client"
// components/shop/ShopSwitcher.tsx
// Which shop am I working in? Always shown for providers, even with one shop, so "Create shop" is
// always one click away. Switching reloads the shop pages (a product of one shop is not a product
// of another): it opens the same section of the other shop (the list, not a product's edit page).
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import type { MyShop } from "@/lib/access/shops"
import { parseShopPath, shopPath } from "@/lib/shop-paths"

export default function ShopSwitcher({ shops, activeId }: { shops: MyShop[]; activeId: string | null }) {
    const router = useRouter()
    const toast = useToast()
    const [open, setOpen] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const box = useRef<HTMLDivElement>(null)

    const active = shops.find((s) => s.id === activeId)
    // Shops are grouped under their business only when the person works in more than one business;
    // with a single business the heading would just repeat what the Business area already says.
    const groups: { id: string; name: string; shops: MyShop[] }[] = []
    for (const shop of shops) {
        const group = groups.find((g) => g.id === shop.businessId)
        if (group) group.shops.push(shop)
        else groups.push({ id: shop.businessId, name: shop.businessName, shops: [shop] })
    }
    const severalBusinesses = groups.length > 1

    useEffect(() => {
        if (!open) return
        function onDown(e: MouseEvent) {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    async function choose(shop: MyShop) {
        if (shop.status !== "ACTIVE") return
        if (shop.id === activeId) {
            setOpen(false)
            return
        }
        setBusyId(shop.id)
        try {
            const res = await fetch("/api/me/active-shop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ providerId: shop.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not switch shop", { description: data.error })
                return
            }
            setOpen(false)
            toast.success(`Now working in ${shop.name}`)

            // The address decides the shop; the cookie above only remembers it as "the one I used last".
            const here = parseShopPath(window.location.pathname)
            const section = here?.section.split("/")[0] || "dashboard"
            router.push(shopPath(shop.publicShopId, section))
        } catch {
            toast.error("Something went wrong", { description: "The shop was not switched." })
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div ref={box} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-8 max-w-56 items-center gap-2 rounded-lg border border-zinc-200 bg-white pl-2.5 pr-2 text-sm font-medium text-zinc-900 hover:border-zinc-300"
            >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 text-[11px] font-semibold text-white" aria-hidden>
                    {(active?.name ?? "?").trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{active?.name ?? "No shop"}</span>
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 8l4 4 4-4" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <p className="px-3.5 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Your shops</p>
                    <ul role="listbox" aria-label="Your shops" className="max-h-72 overflow-y-auto py-1">
                        {groups.map((group) => (
                        <li key={group.id} role="presentation">
                        {severalBusinesses && (
                            <p className="px-3.5 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{group.name}</p>
                        )}
                        <ul role="presentation">
                        {group.shops.map((shop) => {
                            const isActive = shop.id === activeId
                            const pending = shop.status === "PENDING"
                            return (
                                <li key={shop.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        aria-disabled={pending}
                                        disabled={pending || busyId !== null}
                                        onClick={() => choose(shop)}
                                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-zinc-900">{shop.name}</span>
                                            <span className="block truncate text-xs text-zinc-400">
                                                {pending
                                                    ? "Waiting for approval"
                                                    : [shop.city, shop.roles.join(", ")].filter(Boolean).join(" · ")}
                                            </span>
                                        </span>
                                        {isActive && (
                                            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Current shop">
                                                <path d="M4 10l4 4 8-8" />
                                            </svg>
                                        )}
                                        {busyId === shop.id && <span className="text-xs text-zinc-400">Switching...</span>}
                                    </button>
                                </li>
                            )
                        })}
                        </ul>
                        </li>
                        ))}
                    </ul>
                    <div className="border-t border-zinc-100 p-1">
                        <Link
                            href="/become-provider"
                            onClick={() => setOpen(false)}
                            className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                        >
                            <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-base leading-none text-zinc-500">+</span>
                            Create shop
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}