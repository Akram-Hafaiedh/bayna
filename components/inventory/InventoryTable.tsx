"use client"
// components/inventory/InventoryTable.tsx
// Every product with its quantity in each warehouse. "Manage" opens the dialog to receive, adjust, count,
// transfer or set the reorder point.
import { useState } from "react"
import { UNIT_LABELS } from "@/lib/catalogue/units"
import { stockState } from "@/lib/inventory/stock-rules"
import type { InventoryItem } from "@/lib/inventory/inventory-view"
import StockDialog, { type DialogWarehouse } from "./StockDialog"

const STATE_STYLE = { out: "text-red-700", low: "text-amber-700", ok: "text-zinc-900" } as const
const STATE_NOTE = { out: "Out", low: "Low", ok: "" } as const

export default function InventoryTable({
    items,
    warehouses,
    selectedWarehouseId,
    canAdjust,
    canTransfer,
}: {
    items: InventoryItem[]
    warehouses: DialogWarehouse[]
    selectedWarehouseId: string | null
    canAdjust: boolean
    canTransfer: boolean
}) {
    const [open, setOpen] = useState<InventoryItem | null>(null)
    const shown = selectedWarehouseId ? warehouses.filter((w) => w.id === selectedWarehouseId) : warehouses
    const canManage = canAdjust || (canTransfer && warehouses.length > 1)
    const startId = selectedWarehouseId ?? warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? ""
    // The dialog shows the row as it is now, so a refresh after saving updates it
    const current = open ? (items.find((i) => i.id === open.id) ?? open) : null

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                        <tr>
                            <th scope="col" className="px-4 py-3 font-medium">Product</th>
                            {shown.map((w) => (
                                <th key={w.id} scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">
                                    {w.name}{w.isDefault && <span className="ml-1 text-xs font-normal text-zinc-400">default</span>}
                                </th>
                            ))}
                            {!selectedWarehouseId && <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>}
                            {canManage && <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {items.map((p) => (
                            <tr key={p.id}>
                                <td className="px-4 py-3">
                                    <p className="font-medium text-zinc-900">{p.name}</p>
                                    <p className="text-xs text-zinc-500">
                                        {[p.brand, p.sku, UNIT_LABELS[p.unit]].filter(Boolean).join(" · ")}
                                    </p>
                                </td>
                                {shown.map((w) => {
                                    const level = p.levels[w.id]
                                    const q = level?.quantity ?? 0
                                    const st = stockState(q, level?.reorderPoint ?? null)
                                    return (
                                        <td key={w.id} className={`px-4 py-3 text-right tabular-nums ${STATE_STYLE[st]}`}>
                                            {q}
                                            {STATE_NOTE[st] && <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">{STATE_NOTE[st]}</span>}
                                        </td>
                                    )
                                })}
                                {!selectedWarehouseId && <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-900">{p.total}</td>}
                                {canManage && (
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" onClick={() => setOpen(p)} className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:border-zinc-300">
                                            Manage
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {current && (
                <StockDialog
                    key={current.id}
                    item={current}
                    warehouses={warehouses}
                    startWarehouseId={startId}
                    canAdjust={canAdjust}
                    canTransfer={canTransfer}
                    onClose={() => setOpen(null)}
                />
            )}
        </>
    )
}
