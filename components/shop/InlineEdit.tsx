"use client"
// components/shop/InlineEdit.tsx
// Edit one number (price or stock) in place, in the products table. Enter saves, Escape cancels.
// It sends only that field, so it needs only that field's permission (product.price.edit or
// product.stock.edit); the server checks it again.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shop-fetch"

type Props = {
    productId: string
    field: "price" | "stock"
    /** The current value as shown: a price string like "12.500" or a whole number */
    value: string | number
    canEdit: boolean
    /** What to show when not editing */
    children: React.ReactNode
}

export default function InlineEdit({ productId, field, value, canEdit, children }: Props) {
    const router = useRouter()
    const toast = useToast()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(String(value))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    if (!canEdit) return <>{children}</>

    function open() {
        setDraft(field === "price" ? Number(value).toFixed(3) : String(value))
        setError("")
        setEditing(true)
    }

    async function save() {
        const unchanged = Number(draft) === Number(value)
        if (unchanged) {
            setEditing(false)
            return
        }
        setSaving(true)
        setError("")
        try {
            const res = await shopFetch(`/api/shop/products/${productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: draft }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || "Could not save")
                return
            }
            setEditing(false)
            toast.success(field === "price" ? `Price set to ${Number(draft).toFixed(3)} TND` : `Stock set to ${Number(draft)}`)
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setSaving(false)
        }
    }

    if (!editing) {
        return (
            <button
                type="button"
                onClick={open}
                title={field === "price" ? "Edit price" : "Edit stock"}
                className="group inline-flex items-baseline gap-1.5 rounded text-left hover:bg-zinc-100 -mx-1 px-1"
            >
                <span>{children}</span>
                <span aria-hidden className="text-[11px] text-zinc-300 group-hover:text-zinc-500">
                    edit
                </span>
            </button>
        )
    }

    return (
        <div className="min-w-28">
            <input
                autoFocus
                type="number"
                inputMode={field === "price" ? "decimal" : "numeric"}
                step={field === "price" ? "0.001" : "1"}
                min={field === "price" ? "0.001" : "0"}
                value={draft}
                disabled={saving}
                aria-label={field === "price" ? "New price in TND" : "New stock"}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") save()
                    if (e.key === "Escape") setEditing(false)
                }}
                className="h-8 w-28 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="mt-1 flex items-center gap-2 text-xs">
                <button type="button" onClick={save} disabled={saving} className="font-medium text-zinc-900 hover:underline disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-zinc-500 hover:text-zinc-900">
                    Cancel
                </button>
            </div>
            {error && <p className="mt-1 max-w-48 text-xs text-red-600">{error}</p>}
        </div>
    )
}
