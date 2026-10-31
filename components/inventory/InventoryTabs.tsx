"use client"
// components/inventory/InventoryTabs.tsx
// The three pages of the inventory module: stock, warehouses, history.
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { shopPath } from "@/lib/shops/shop-paths"

const TABS = [
    { section: "inventory", label: "Stock", exact: true },
    { section: "inventory/warehouses", label: "Warehouses", exact: false },
    { section: "inventory/history", label: "History", exact: false },
] as const

export default function InventoryTabs() {
    const pathname = usePathname()
    const params = useParams<{ publicShopId?: string }>()
    const publicShopId = typeof params?.publicShopId === "string" ? params.publicShopId : ""
    if (!publicShopId) return null
    return (
        <nav aria-label="Inventory" className="flex gap-1 border-b border-zinc-200">
            {TABS.map((t) => {
                const href = shopPath(publicShopId, t.section)
                const active = t.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
                return (
                    <Link
                        key={t.section}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
                    >
                        {t.label}
                    </Link>
                )
            })}
        </nav>
    )
}
