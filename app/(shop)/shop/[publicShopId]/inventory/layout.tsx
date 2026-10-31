// The inventory module: one header and the three tabs (stock, warehouses, history).
// The layout does not read the address itself (that would block the page); the tabs read it on the client.
import { Suspense } from "react"
import type { Metadata } from "next"
import InventoryTabs from "@/components/inventory/InventoryTabs"

export const metadata: Metadata = { title: "Inventory" }

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Inventory</h1>
                <p className="mt-1 text-sm text-zinc-500">Where your stock is, and every change to it</p>
            </div>
            <Suspense fallback={<div className="h-10 border-b border-zinc-200" />}>
                <InventoryTabs />
            </Suspense>
            {children}
        </div>
    )
}
