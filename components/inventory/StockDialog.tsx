"use client"
// components/inventory/StockDialog.tsx
// Change the stock of one product: receive, adjust, count, move between warehouses, or set the reorder point.
// It shows what the warehouse will hold before you save, using the same rule the server applies.
import { useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shops/shop-fetch"
import { planMovement, type ManualType } from "@/lib/inventory/stock-rules"
import { REASON_LABEL, reasonOptions, type ReasonCode } from "@/lib/inventory/stock-reasons"
import type { InventoryItem } from "@/lib/inventory/inventory-view"

export type DialogWarehouse = { id: string; name: string; isDefault: boolean }
type Mode = ManualType | "TRANSFER" | "REORDER"

const MODE_LABEL: Record<Mode, string> = {
    RECEIVED: "Receive", RETURNED: "Return", ADJUSTED: "Adjust", COUNTED: "Count", TRANSFER: "Transfer", REORDER: "Low-stock alert",
}

const field = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
const label = "mb-1 block text-sm font-medium text-zinc-700"

export default function StockDialog({
    item,
    warehouses,
    startWarehouseId,
    canAdjust,
    canTransfer,
    onClose,
}: {
    item: InventoryItem
    warehouses: DialogWarehouse[]
    /** The warehouse picked in the filter, or the default one */
    startWarehouseId: string
    canAdjust: boolean
    canTransfer: boolean
    onClose: () => void
}) {
    const router = useRouter()
    const toast = useToast()
    const modes: Mode[] = [
        ...(canAdjust ? (["RECEIVED", "RETURNED", "ADJUSTED", "COUNTED"] as const) : []),
        ...(canTransfer && warehouses.length > 1 ? (["TRANSFER"] as const) : []),
        ...(canAdjust ? (["REORDER"] as const) : []),
    ]
    const [mode, setMode] = useState<Mode>(modes[0])
    const [warehouseId, setWarehouseId] = useState(startWarehouseId)
    const [toId, setToId] = useState(() => warehouses.find((w) => w.id !== startWarehouseId)?.id ?? "")
    const [amount, setAmount] = useState("")
    const [reorder, setReorder] = useState(() => String(item.levels[startWarehouseId]?.reorderPoint ?? ""))
    const [reasonCode, setReasonCode] = useState<ReasonCode | "">("")
    const [note, setNote] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const here = item.levels[warehouseId]?.quantity ?? 0
    const isManual = mode !== "REORDER" && mode !== "TRANSFER"
    // The reasons depend on the kind of change, and for an adjustment on its sign (+ or -)
    const signed = amount.trim() === "" ? null : Number(amount)
    const options = isManual ? reasonOptions(mode, mode === "ADJUSTED" ? signed : 1) : []
    const code: ReasonCode | "" = reasonCode && options.includes(reasonCode) ? reasonCode : ""
    const needsNote = code === "OTHER"
    const name = (id: string) => warehouses.find((w) => w.id === id)?.name ?? ""

    // What the warehouse will hold, by the same rule as the server
    const n = amount.trim() === "" ? null : Number(amount)
    let preview: { text: string; ok: boolean } | null = null
    if (n !== null && Number.isFinite(n) && mode !== "REORDER") {
        const r = planMovement(mode === "TRANSFER" ? "TRANSFER_OUT" : mode, here, n)
        preview = r.ok
            ? { text: `${name(warehouseId)} will hold ${r.value.after}`, ok: true }
            : { text: r.error, ok: false }
    }

    function pickWarehouse(id: string) {
        setWarehouseId(id)
        setReorder(String(item.levels[id]?.reorderPoint ?? ""))
        if (toId === id) setToId(warehouses.find((w) => w.id !== id)?.id ?? "")
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            let res: Response
            if (mode === "REORDER") {
                res = await shopFetch("/api/shop/stock/reorder", {
                    method: "PATCH", headers: { "content-type": "application/json" },
                    body: JSON.stringify({ productId: item.id, warehouseId, reorderPoint: reorder.trim() === "" ? null : Number(reorder) }),
                })
            } else if (mode === "TRANSFER") {
                res = await shopFetch("/api/shop/stock/transfer", {
                    method: "POST", headers: { "content-type": "application/json" },
                    body: JSON.stringify({ productId: item.id, fromId: warehouseId, toId, quantity: Number(amount), reason: note }),
                })
            } else {
                res = await shopFetch("/api/shop/stock", {
                    method: "POST", headers: { "content-type": "application/json" },
                    body: JSON.stringify({ productId: item.id, warehouseId, type: mode, quantity: Number(amount), reasonCode: code, reason: note }),
                })
            }
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Could not save")
                return
            }
            toast.success(mode === "REORDER" ? "Low-stock alert saved" : "Stock updated", { description: item.name })
            router.refresh()
            onClose()
        } catch {
            setError("Something went wrong. Nothing was changed.")
        } finally {
            setBusy(false)
        }
    }

    const amountLabel =
        mode === "RECEIVED" ? "Quantity received" : mode === "RETURNED" ? "Quantity returned" : mode === "ADJUSTED" ? "Change (a minus takes stock out)" : mode === "COUNTED" ? "Counted quantity" : "Quantity to move"

    return (
        <Modal title={item.name} description={`${item.total} in total across the warehouses`} onClose={onClose}>
            <div role="tablist" aria-label="What to do" className="mb-4 flex flex-wrap gap-1">
                {modes.map((m) => (
                    <button
                        key={m} type="button" role="tab" aria-selected={mode === m}
                        onClick={() => { setMode(m); setError(null); setAmount(""); setReasonCode(""); setNote("") }}
                        className={`rounded-full border px-3 py-1 text-sm ${mode === m ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"}`}
                    >
                        {MODE_LABEL[m]}
                    </button>
                ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
                <div>
                    <label htmlFor="sd-warehouse" className={label}>{mode === "TRANSFER" ? "From" : "Warehouse"}</label>
                    <select id="sd-warehouse" value={warehouseId} onChange={(e) => pickWarehouse(e.target.value)} className={field}>
                        {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}{w.isDefault ? " (default)" : ""} · {item.levels[w.id]?.quantity ?? 0}</option>
                        ))}
                    </select>
                </div>

                {mode === "TRANSFER" && (
                    <div>
                        <label htmlFor="sd-to" className={label}>To</label>
                        <select id="sd-to" value={toId} onChange={(e) => setToId(e.target.value)} className={field}>
                            {warehouses.filter((w) => w.id !== warehouseId).map((w) => (
                                <option key={w.id} value={w.id}>{w.name} · {item.levels[w.id]?.quantity ?? 0}</option>
                            ))}
                        </select>
                    </div>
                )}

                {mode === "REORDER" ? (
                    <div>
                        <label htmlFor="sd-reorder" className={label}>Low when it holds this many or fewer</label>
                        <input id="sd-reorder" type="number" min={0} step={1} inputMode="numeric" value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="Leave empty for no alert" className={field} />
                        <p className="mt-1 text-xs text-zinc-500">Counted for {name(warehouseId)} only.</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <label htmlFor="sd-amount" className={label}>{amountLabel}</label>
                            <input id="sd-amount" type="number" step={1} inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field} autoFocus />
                            {preview && <p className={`mt-1 text-xs ${preview.ok ? "text-zinc-500" : "text-red-600"}`}>{preview.text}</p>}
                        </div>
                        {isManual && (
                            <div>
                                <label htmlFor="sd-why" className={label}>Reason</label>
                                <select id="sd-why" value={code} onChange={(e) => setReasonCode(e.target.value as ReasonCode | "")} required disabled={options.length === 0} className={field}>
                                    <option value="" disabled>
                                        {options.length === 0 ? "Enter the change first" : "Choose a reason"}
                                    </option>
                                    {options.map((c) => <option key={c} value={c}>{REASON_LABEL[c]}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="sd-note" className={label}>Note {needsNote ? <span className="font-normal text-zinc-500">(required)</span> : <span className="font-normal text-zinc-400">(optional)</span>}</label>
                            <input id="sd-note" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} required={needsNote} placeholder={mode === "TRANSFER" ? "Why you are moving it" : "Anything worth knowing later"} className={field} />
                        </div>
                    </>
                )}

                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300">Cancel</button>
                    <button type="submit" disabled={busy || (preview !== null && !preview.ok) || (isManual && (!code || (needsNote && !note.trim())))} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                        {busy ? "Saving..." : "Save"}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
