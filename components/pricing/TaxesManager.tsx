"use client"
// components/pricing/TaxesManager.tsx
// The shop's taxes: add, edit, switch on or off, reorder, delete. The order is the order they apply in, so
// it is shown, and a worked example (a price of 100) shows what the taxes add up to.
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Modal from "@/components/ui/Modal"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shops/shop-fetch"
import { APPLIES_ON_LABEL, TAX_LABEL, computePrice, type TaxAppliesOnValue, type TaxKindValue } from "@/lib/pricing/price-rules"
import type { TaxRow } from "@/lib/pricing/taxes"
import TaxesHeader from "./TaxesHeader"

const field = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
const label = "mb-1 block text-sm font-medium text-zinc-700"
const JSON_HEADERS = { "content-type": "application/json" }

/** "19 %" or "0.500 TND per unit" (trailing zeros of a stored value are dropped for percentages) */
export function taxValueText(t: { kind: TaxKindValue; value: string }): string {
    if (t.kind === "FIXED") return `${Number(t.value).toFixed(3)} TND per unit`
    return `${Number(t.value)} %`
}

export default function TaxesManager({
    taxes,
    canManage,
    toSetCount,
    toSetHref,
}: {
    taxes: TaxRow[]
    canManage: boolean
    /** Products with no tax chosen and not marked exempt */
    toSetCount: number
    toSetHref: string
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [editing, setEditing] = useState<TaxRow | "new" | null>(null)

    async function call(url: string, init: RequestInit, done: (data: Record<string, unknown>) => string) {
        try {
            const res = await shopFetch(url, init)
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not save", { description: data.error })
                return false
            }
            toast.success(done(data))
            router.refresh()
            return true
        } catch {
            toast.error("Something went wrong", { description: "Nothing was changed." })
            return false
        }
    }

    function move(index: number, by: -1 | 1) {
        const ids = taxes.map((t) => t.id)
        const [id] = ids.splice(index, 1)
        ids.splice(index + by, 0, id)
        void call("/api/shop/taxes/reorder", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ ids }) }, () => "Order saved")
    }

    async function remove(t: TaxRow) {
        const yes = await confirm({
            title: `Delete "${t.name}"?`,
            message: t.productCount > 0
                ? `${t.productCount} product${t.productCount === 1 ? "" : "s"} carry it. They are priced again without it, and a product left with no tax shows as "Tax to set". This cannot be undone.`
                : "No product carries it. This cannot be undone.",
            confirmLabel: "Delete",
            tone: "danger",
        })
        if (yes) {
            await call(`/api/shop/taxes/${t.id}`, { method: "DELETE" }, (d) => {
                const n = Number(d.productsChanged ?? 0)
                return n > 0 ? `"${t.name}" deleted, ${n} product${n === 1 ? "" : "s"} priced again` : `"${t.name}" deleted`
            })
        }
    }

    return (
        <div className="space-y-6">
            <TaxesHeader>
                {canManage && (
                    <button
                        type="button"
                        onClick={() => setEditing("new")}
                        className="h-10 shrink-0 inline-flex items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                        Add tax
                    </button>
                )}
            </TaxesHeader>

            {toSetCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">{toSetCount} product{toSetCount === 1 ? " has" : "s have"} no tax chosen yet</p>
                    <p className="mt-0.5 text-amber-800">
                        Until you choose {toSetCount === 1 ? "its" : "their"} taxes, or mark {toSetCount === 1 ? "it" : "them"} exempt, the price with tax is the same as the price before tax.
                    </p>
                    <Link href={toSetHref} className="mt-2 inline-block font-medium underline">Show them</Link>
                </div>
            )}

            {taxes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                    <p className="font-medium text-zinc-900">No taxes yet</p>
                    <p className="mt-1 text-sm text-zinc-500">
                        Add the taxes you charge. You then choose, product by product, which ones apply, or mark a product as exempt.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setEditing("new")}
                            className="mt-4 inline-flex h-10 items-center px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                        >
                            Add your first tax
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-medium" title="The order the taxes apply in">Order</th>
                                <th scope="col" className="px-4 py-3 font-medium">Tax</th>
                                <th scope="col" className="px-4 py-3 font-medium">Rate</th>
                                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Applies</th>
                                <th scope="col" className="px-4 py-3 font-medium">Products</th>
                                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Status</th>
                                {canManage && (
                                    <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {taxes.map((t, i) => (
                                <tr key={t.id} className="hover:bg-zinc-50/60">
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <div className="flex items-center gap-1 text-zinc-700">
                                            <span className="w-5 tabular-nums">{i + 1}</span>
                                            {canManage && (
                                                <>
                                                    <button
                                                        type="button" onClick={() => move(i, -1)} disabled={i === 0}
                                                        aria-label={`Move ${t.name} up`}
                                                        className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
                                                    >
                                                        <span aria-hidden>↑</span>
                                                    </button>
                                                    <button
                                                        type="button" onClick={() => move(i, 1)} disabled={i === taxes.length - 1}
                                                        aria-label={`Move ${t.name} down`}
                                                        className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
                                                    >
                                                        <span aria-hidden>↓</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 font-medium ${t.isActive ? "text-zinc-900" : "text-zinc-500"}`}>{t.name}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-900">{taxValueText(t)}</td>
                                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell">
                                        {t.kind === "FIXED" ? "Added per unit" : t.appliesOn === "BASE" ? "On the price" : "On the running total"}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{t.productCount}</td>
                                    <td className="hidden px-4 py-3 md:table-cell">
                                        <span className={`rounded-full px-2 py-0.5 text-xs ${t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                                            {t.isActive ? "Active" : "Switched off"}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-4">
                                                <button type="button" onClick={() => setEditing(t)} className="text-sm text-zinc-600 hover:text-zinc-900">Edit</button>
                                                <button type="button" onClick={() => void remove(t)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Example taxes={taxes} />

            {editing && (
                <TaxForm
                    tax={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); router.refresh() }}
                />
            )}
        </div>
    )
}

/** What the active taxes, in this order, add to a price of 100.000: the same arithmetic the products use */
function Example({ taxes }: { taxes: TaxRow[] }) {
    const active = taxes.filter((t) => t.isActive)
    if (active.length === 0) return null
    let r
    try {
        r = computePrice("100.000", active)
    } catch {
        return null
    }
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">How it adds up</h2>
            <p className="mt-0.5 text-sm text-zinc-500">A product at 100.000 TND before tax that carries all the taxes above, in this order.</p>
            <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-zinc-500">Price before tax</dt><dd className="tabular-nums text-zinc-900">{r.base}</dd></div>
                {r.lines.map((l) => (
                    <div key={l.taxId} className="flex justify-between"><dt className="text-zinc-500">{l.name}</dt><dd className="tabular-nums text-zinc-900">+ {l.amount}</dd></div>
                ))}
                <div className="flex justify-between border-t border-zinc-100 pt-1 font-medium"><dt className="text-zinc-900">Price with tax</dt><dd className="tabular-nums text-zinc-900">{r.total} TND</dd></div>
            </dl>
        </section>
    )
}

function TaxForm({ tax, onClose, onSaved }: { tax: TaxRow | null; onClose: () => void; onSaved: () => void }) {
    const toast = useToast()
    const [name, setName] = useState(tax?.name ?? "")
    const [kind, setKind] = useState<TaxKindValue>(tax?.kind ?? "PERCENTAGE")
    const [value, setValue] = useState(tax ? String(Number(tax.value)) : "")
    const [appliesOn, setAppliesOn] = useState<TaxAppliesOnValue>(tax?.appliesOn ?? "BASE")
    const [isActive, setIsActive] = useState(tax?.isActive ?? true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        try {
            const body = { name, kind, value, appliesOn: kind === "FIXED" ? "BASE" : appliesOn, ...(tax ? { isActive } : {}) }
            const res = await shopFetch(tax ? `/api/shop/taxes/${tax.id}` : "/api/shop/taxes", {
                method: tax ? "PATCH" : "POST", headers: JSON_HEADERS, body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error ?? "Could not save")
                return
            }
            toast.success(tax ? "Tax saved" : "Tax added")
            onSaved()
        } catch {
            setError("Something went wrong. Nothing was saved.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={tax ? "Edit tax" : "Add tax"} onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                <div>
                    <label htmlFor="tax-name" className={label}>Name</label>
                    <input id="tax-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} placeholder="VAT" className={field} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="tax-kind" className={label}>Type</label>
                        <select id="tax-kind" value={kind} onChange={(e) => setKind(e.target.value as TaxKindValue)} className={field}>
                            <option value="PERCENTAGE">{TAX_LABEL.PERCENTAGE}</option>
                            <option value="FIXED">{TAX_LABEL.FIXED}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="tax-value" className={label}>{kind === "FIXED" ? "Amount (TND)" : "Rate (%)"}</label>
                        <input
                            id="tax-value" value={value} onChange={(e) => setValue(e.target.value)} required
                            type="number" inputMode="decimal" min={kind === "FIXED" ? "0.001" : "0.0001"} max={kind === "FIXED" ? undefined : "100"} step={kind === "FIXED" ? "0.001" : "0.0001"}
                            className={field}
                        />
                    </div>
                </div>
                {kind === "PERCENTAGE" ? (
                    <div>
                        <label htmlFor="tax-on" className={label}>Applies</label>
                        <select id="tax-on" value={appliesOn} onChange={(e) => setAppliesOn(e.target.value as TaxAppliesOnValue)} className={field}>
                            <option value="BASE">{APPLIES_ON_LABEL.BASE}</option>
                            <option value="RUNNING">{APPLIES_ON_LABEL.RUNNING}</option>
                        </select>
                        <p className="mt-1 text-xs text-zinc-500">Taxes apply in the order of the list, so a tax on the running total sits on top of the ones above it.</p>
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500">A fixed amount is added once per unit sold, on top of the price before tax.</p>
                )}
                {tax && (
                    <label className="flex items-start gap-2.5 text-sm text-zinc-700">
                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mt-0.5 rounded border-zinc-300" />
                        <span>
                            <span className="font-medium text-zinc-900">Active</span>
                            <span className="block text-zinc-500">A switched-off tax stays on its products but adds nothing to their price.</span>
                        </span>
                    </label>
                )}
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300">Cancel</button>
                    <button type="submit" disabled={busy} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? "Saving..." : "Save"}</button>
                </div>
            </form>
        </Modal>
    )
}
