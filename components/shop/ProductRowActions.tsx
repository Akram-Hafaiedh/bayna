"use client"
// components/shop/ProductRowActions.tsx
// The "..." menu of a product row: edit, price history, stock, status (a submenu), clone and delete.
// Which actions show depends on what the person may do (`actions`); the routes check it again.
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import RowMenu, { type RowMenuItem } from "@/components/ui/RowMenu"
import { useConfirm } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"
import { shopFetch } from "@/lib/shops/shop-fetch"
import { PRODUCT_STATUS_LABEL, SHOP_CHOICES, type ProductStatusValue } from "@/lib/products/product-status"
import { PRICE_CHECK_NOTE, restoreProduct } from "./restore-product"

export type ProductActions = {
    /** product.listing.edit: change the status */
    edit: boolean
    /** product.listing.create and product.price.edit: a copy has a price */
    clone: boolean
    /** product.listing.delete */
    remove: boolean
}

export default function ProductRowActions({
    id,
    name,
    status,
    shopBase,
    actions,
}: {
    id: string
    name: string
    status: ProductStatusValue
    /** "/shop/<publicShopId>" */
    shopBase: string
    actions: ProductActions
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const toast = useToast()
    const [, startTransition] = useTransition()
    const refresh = () => startTransition(() => router.refresh())

    async function setStatus(next: ProductStatusValue) {
        try {
            const res = await shopFetch(`/api/shop/products/${id}`, {
                method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not change the status", { description: data.error })
                return
            }
            toast.success(`"${name}" is now ${PRODUCT_STATUS_LABEL[next].toLowerCase()}`)
            refresh()
        } catch {
            toast.error("Something went wrong", { description: "The status was not changed." })
        }
    }

    async function clone() {
        try {
            const res = await shopFetch(`/api/shop/products/${id}/clone`, { method: "POST" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not copy the product", { description: data.error })
                return
            }
            toast.success(`Draft copy of "${name}" created`)
            // Open the copy: the usual next step is to rename it and change what differs
            router.push(`${shopBase}/products/${data.product.id}/edit`)
            router.refresh()
        } catch {
            toast.error("Something went wrong", { description: "Nothing was copied." })
        }
    }

    async function undo() {
        const result = await restoreProduct(id)
        if (!result.ok) {
            toast.error("Could not undo", { description: result.error })
            return
        }
        toast.success(`Restored "${name}"`, result.needsPriceReview ? { description: PRICE_CHECK_NOTE } : undefined)
        refresh()
    }

    async function remove() {
        const yes = await confirm({
            title: `Move "${name}" to trash?`,
            message: "It disappears from your list and from search. You can restore it from the Trash at any time.",
            confirmLabel: "Move to trash",
            tone: "danger",
        })
        if (!yes) return
        try {
            const res = await shopFetch(`/api/shop/products/${id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error("Could not remove the product", { description: data.error })
                return
            }
            toast.success(`"${name}" moved to trash`, data.canRestore ? { action: { label: "Undo", onClick: undo } } : undefined)
            refresh()
        } catch {
            toast.error("Something went wrong", { description: "The product was not removed." })
        }
    }

    const items: RowMenuItem[] = [
        { label: "Edit", href: `${shopBase}/products/${id}/edit` },
        { label: "Price history", href: `${shopBase}/products/${id}/history` },
        { label: "Manage stock", href: `${shopBase}/inventory?q=${encodeURIComponent(name)}` },
    ]
    // A product the platform team blocked is theirs to change
    if (actions.edit && status !== "BLOCKED") {
        items.push({
            label: "Status",
            divider: true,
            children: SHOP_CHOICES.map((s) => ({
                label: PRODUCT_STATUS_LABEL[s],
                checked: s === status,
                onClick: () => void setStatus(s),
            })),
        })
    }
    if (actions.clone) items.push({ label: "Make a copy", divider: !(actions.edit && status !== "BLOCKED"), onClick: () => void clone() })
    if (actions.remove) items.push({ label: "Delete", danger: true, divider: true, onClick: () => void remove() })

    return <RowMenu label={`Actions for ${name}`} items={items} />
}
