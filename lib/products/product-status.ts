// lib/product-status.ts
// The life of a product listing. Pure (unit tested); the routes and forms ask this file what is allowed.
//
//   DRAFT    not finished; only the shop sees it
//   ACTIVE   listed: customers can see and request it
//   HIDDEN   the shop pulled it for now
//   BLOCKED  removed from sale by the platform team; the shop cannot change it back
//
// Deleting stays `deletedAt` (the Trash), not a status.

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "HIDDEN", "BLOCKED"] as const
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number]

export const PRODUCT_STATUS_LABEL: Record<ProductStatusValue, string> = {
    DRAFT: "Draft",
    ACTIVE: "Active",
    HIDDEN: "Hidden",
    BLOCKED: "Blocked",
}

/** What a shop may choose in the product form (BLOCKED is only ever set by the platform team). */
export const SHOP_CHOICES = ["DRAFT", "ACTIVE", "HIDDEN"] as const satisfies readonly ProductStatusValue[]

export const isProductStatus = (v: unknown): v is ProductStatusValue =>
    typeof v === "string" && (PRODUCT_STATUSES as readonly string[]).includes(v)

/** Customers see and can request the product. */
export const isListed = (status: ProductStatusValue) => status === "ACTIVE"

/**
 * Can a shop move a product from `from` to `to`? Blocked products stay as they are (saving the form
 * with the same status is fine), and a shop cannot block anything itself.
 */
export function shopMayChange(from: ProductStatusValue, to: ProductStatusValue): boolean {
    if (from === to) return true
    if (from === "BLOCKED" || to === "BLOCKED") return false
    return true
}

/** The platform team blocks any product that is not blocked yet, and lifts a block. */
export function platformMove(action: "block" | "unblock", from: ProductStatusValue): ProductStatusValue | null {
    if (action === "block") return from === "BLOCKED" ? null : "BLOCKED"
    // Lifting a block puts the product back as the shop's own draft: the shop decides when to list it again
    return from === "BLOCKED" ? "DRAFT" : null
}
