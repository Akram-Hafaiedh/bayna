"use client"
// components/inventory/WarehousesManager.tsx
// The shop's warehouses: add, edit, make default, archive, restore, delete.
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Modal from "@/components/ui/Modal"
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shops/shop-fetch"
import { GOVERNORATE_NAMES } from "@/lib/shared/governorates"
import type { WarehouseRow } from "@/lib/inventory/warehouses"

const field = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
const label = "mb-1 block text-sm font-medium text-zinc-700"
const JSON_HEADERS = { "content-type": "application/json" }

export default function WarehousesManager({
    warehouses,
    historyBase,
    canManage,
}: {
    warehouses: WarehouseRow[]
    /** "/shop/<id>/inventory/history" */
    historyBase: string
    canManage: boolean
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [editing, setEditing] = useState<WarehouseRow | "new" | null>(null)

    async function call(url: string, init: RequestInit, done: string) {
        try {
            const res = await shopFetch(url, init)
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not save", { description: data.error })
                return false
            }
            toast.success(done)
            router.refresh()
            return true
        } catch {
            toast.error("Something went wrong", { description: "Nothing was changed." })
            return false
        }
    }

    const patch = (w: WarehouseRow, body: Record<string, unknown>, done: string) =>
        call(`/api/shop/warehouses/${w.id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) }, done)

    async function archive(w: WarehouseRow) {
        const yes = await confirm({
            title: `Archive "${w.name}"?`,
            message: "It stops taking stock and leaves the lists. Its history is kept, and you can restore it later.",
            confirmLabel: "Archive",
        })
        if (yes) await patch(w, { archived: true }, `"${w.name}" archived`)
    }

    async function remove(w: WarehouseRow) {
        const yes = await confirm({
            title: `Delete "${w.name}"?`,
            message: "It never held any stock, so nothing is lost. This cannot be undone.",
            confirmLabel: "Delete",
            tone: "danger",
        })
        if (yes) await call(`/api/shop/warehouses/${w.id}`, { method: "DELETE" }, `"${w.name}" deleted`)
    }

    function menu(w: WarehouseRow): RowMenuItem[] {
        const items: RowMenuItem[] = [{ label: "View history", href: `${historyBase}?warehouse=${w.id}` }]
        if (!canManage) return items
        items.push({ label: "Edit", onClick: () => setEditing(w) })
        if (w.archivedAt) {
            items.push({ label: "Restore", onClick: () => void patch(w, { archived: false }, `"${w.name}" restored`) })
        } else {
            if (!w.isDefault) items.push({ label: "Make default", onClick: () => void patch(w, { makeDefault: true }, `"${w.name}" is now the default`) })
            if (!w.isDefault) items.push({ label: "Archive", onClick: () => void archive(w) })
        }
        if (!w.isDefault && w.movementCount === 0) items.push({ label: "Delete", danger: true, onClick: () => void remove(w) })
        return items
    }

    return (
        <div className="space-y-4">
            {canManage && (
                <div className="flex justify-end">
                    <button type="button" onClick={() => setEditing("new")} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                        Add warehouse
                    </button>
                </div>
            )}

            <ul className="space-y-3">
                {warehouses.map((w) => (
                    <li key={w.id} className={`rounded-xl border bg-white p-4 ${w.archivedAt ? "border-zinc-200 opacity-70" : "border-zinc-200"}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Link href={`${historyBase}?warehouse=${w.id}`} className="font-medium text-zinc-900 hover:underline">{w.name}</Link>
                                    {w.isDefault && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">Default</span>}
                                    {w.archivedAt && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Archived</span>}
                                </div>
                                <p className="mt-0.5 text-sm text-zinc-500">
                                    {[w.address, w.city, w.governorate && w.governorate !== w.city ? w.governorate : null].filter(Boolean).join(", ")}
                                </p>
                            </div>
                            <RowMenu label={`Actions for ${w.name}`} items={menu(w)} />
                        </div>
                        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                            <div><dt className="inline text-zinc-500">Products </dt><dd className="inline font-medium text-zinc-900">{w.productCount}</dd></div>
                            <div><dt className="inline text-zinc-500">Units </dt><dd className="inline font-medium text-zinc-900">{w.unitTotal}</dd></div>
                            <div><dt className="inline text-zinc-500">Movements </dt><dd className="inline font-medium text-zinc-900">{w.movementCount}</dd></div>
                        </dl>
                    </li>
                ))}
            </ul>

            {editing && (
                <WarehouseForm
                    warehouse={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); router.refresh() }}
                />
            )}
        </div>
    )
}

function WarehouseForm({ warehouse, onClose, onSaved }: { warehouse: WarehouseRow | null; onClose: () => void; onSaved: () => void }) {
    const toast = useToast()
    const [name, setName] = useState(warehouse?.name ?? "")
    const [address, setAddress] = useState(warehouse?.address ?? "")
    const [city, setCity] = useState(warehouse?.city ?? "")
    const [governorate, setGovernorate] = useState(warehouse?.governorate ?? "")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            const body = { name, address, city, governorate }
            const res = await shopFetch(warehouse ? `/api/shop/warehouses/${warehouse.id}` : "/api/shop/warehouses", {
                method: warehouse ? "PATCH" : "POST", headers: JSON_HEADERS, body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Could not save")
                return
            }
            toast.success(warehouse ? "Warehouse saved" : "Warehouse added")
            onSaved()
        } catch {
            setError("Something went wrong. Nothing was saved.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={warehouse ? "Edit warehouse" : "Add warehouse"} onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                <div>
                    <label htmlFor="wh-name" className={label}>Name</label>
                    <input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="Ben Arous depot" className={field} autoFocus />
                </div>
                <div>
                    <label htmlFor="wh-address" className={label}>Address <span className="font-normal text-zinc-400">(optional)</span></label>
                    <input id="wh-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={field} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="wh-city" className={label}>City</label>
                        <input id="wh-city" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} maxLength={80} className={field} />
                    </div>
                    <div>
                        <label htmlFor="wh-gov" className={label}>Governorate</label>
                        <select id="wh-gov" value={governorate} onChange={(e) => setGovernorate(e.target.value)} required className={field}>
                            <option value="" disabled>Choose</option>
                            {GOVERNORATE_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300">Cancel</button>
                    <button type="submit" disabled={busy} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? "Saving..." : "Save"}</button>
                </div>
            </form>
        </Modal>
    )
}
