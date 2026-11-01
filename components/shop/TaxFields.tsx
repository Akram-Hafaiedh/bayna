"use client"
// components/shop/TaxFields.tsx
// On the product form: which taxes the product carries, or that it is exempt, and the price with tax that
// results (the same arithmetic as the server, so what is shown is what is saved).
import Link from "next/link"
import { computePrice, type TaxInput } from "@/lib/pricing/price-rules"
import type { TaxRow } from "@/lib/pricing/taxes"
import { taxValueText } from "@/components/pricing/TaxesManager"
import { useShopHref } from "@/lib/shops/use-shop"
import { Section } from "./ProductFormParts"

export type TaxFormValue = { taxIds: string[]; taxExempt: boolean }

export default function TaxFields({
    taxes,
    value,
    onChange,
    price,
    canEdit,
}: {
    /** Every tax of the shop, in the order they apply */
    taxes: TaxRow[]
    value: TaxFormValue
    onChange: (next: TaxFormValue) => void
    /** The price before tax, as typed in the form */
    price: string
    canEdit: boolean
}) {
    const shopHref = useShopHref()
    const chosen = taxes.filter((t) => t.isActive && value.taxIds.includes(t.id))
    const unset = !value.taxExempt && chosen.length === 0

    let result: ReturnType<typeof computePrice> | null = null
    if (price.trim() !== "") {
        try {
            result = computePrice(price.trim(), value.taxExempt ? [] : (chosen as TaxInput[]))
        } catch {
            result = null // a price still being typed
        }
    }

    function toggle(id: string) {
        const on = value.taxIds.includes(id)
        onChange({ taxExempt: false, taxIds: on ? value.taxIds.filter((x) => x !== id) : [...value.taxIds, id] })
    }

    return (
        <Section title="Taxes" description="The price above is before tax. Choose the taxes this product carries, or mark it exempt.">
            {!canEdit && (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">You can see the taxes of this product but not change them.</p>
            )}

            <label className="flex items-start gap-2.5 text-sm text-zinc-700">
                <input
                    type="checkbox"
                    checked={value.taxExempt}
                    disabled={!canEdit}
                    onChange={(e) => onChange({ taxExempt: e.target.checked, taxIds: [] })}
                    className="mt-0.5 rounded border-zinc-300"
                />
                <span>
                    <span className="font-medium text-zinc-900">Exempt from tax</span>
                    <span className="block text-zinc-500">No tax is added: the price with tax is the price you entered.</span>
                </span>
            </label>

            {!value.taxExempt && (
                taxes.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                        You have no taxes yet.{" "}
                        <Link href={shopHref("taxes")} className="font-medium text-zinc-900 underline">Add your taxes</Link>
                    </p>
                ) : (
                    <ul className="space-y-2" aria-label="Taxes">
                        {taxes.map((t) => {
                            const on = value.taxIds.includes(t.id)
                            return (
                                <li key={t.id}>
                                    <label className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${on ? "border-zinc-900" : "border-zinc-200"} ${!t.isActive ? "opacity-60" : ""}`}>
                                        <input type="checkbox" checked={on} disabled={!canEdit} onChange={() => toggle(t.id)} className="rounded border-zinc-300" />
                                        <span className="font-medium text-zinc-900">{t.name}</span>
                                        <span className="text-zinc-500">{taxValueText(t)}</span>
                                        {!t.isActive && <span className="ml-auto text-xs text-zinc-500">Switched off, not applied</span>}
                                    </label>
                                </li>
                            )
                        })}
                    </ul>
                )
            )}

            {unset && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Tax to set: until you choose a tax or mark the product exempt, its price with tax is the price before tax.
                </p>
            )}

            {result && (
                <dl className="space-y-1 rounded-lg bg-zinc-50 px-4 py-3 text-sm">
                    <div className="flex justify-between"><dt className="text-zinc-500">Price before tax</dt><dd className="tabular-nums text-zinc-900">{result.base}</dd></div>
                    {result.lines.map((l) => (
                        <div key={l.taxId} className="flex justify-between"><dt className="text-zinc-500">{l.name}</dt><dd className="tabular-nums text-zinc-900">+ {l.amount}</dd></div>
                    ))}
                    <div className="flex justify-between border-t border-zinc-200 pt-1 font-medium"><dt className="text-zinc-900">Price with tax</dt><dd className="tabular-nums text-zinc-900">{result.total} TND</dd></div>
                </dl>
            )}
        </Section>
    )
}
