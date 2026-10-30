// lib/product-restore.ts
// What has to change when a product comes back from the trash. Pure (unit tested).
//
// A trashed product keeps its price and stock. But the shared catalogue may have moved on while it
// sat there: the item may be archived, or sold by a different unit. In that case we do not bring
// back a wrong price quietly: the unit is brought in line and the product is flagged for a price check.
import type { Unit } from "@/app/generated/prisma/enums"
import { unitChangeReason } from "@/lib/products/price-review"

export type RestoreChanges = {
    categoryId?: string
    unit?: Unit
    needsPriceReview?: true
    priceReviewReason?: string
}

export type RestorePlan = { ok: true; changes: RestoreChanges } | { ok: false; error: string }

export function planRestore(
    product: { catalogItemId: string | null; unit: Unit },
    catalog: { isActive: boolean; unit: Unit; categoryId: string } | null
): RestorePlan {
    // A custom product depends on nothing else
    if (!product.catalogItemId) return { ok: true, changes: {} }

    if (!catalog || !catalog.isActive) {
        return { ok: false, error: "This catalogue item is no longer available, so the product cannot be restored." }
    }

    const changes: RestoreChanges = { categoryId: catalog.categoryId }
    if (catalog.unit !== product.unit) {
        changes.unit = catalog.unit
        changes.needsPriceReview = true
        changes.priceReviewReason = unitChangeReason(product.unit, catalog.unit)
    }
    return { ok: true, changes }
}
