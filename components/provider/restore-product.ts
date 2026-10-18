// components/provider/restore-product.ts
// Client helper: bring a product back from the trash. Returns a result instead of throwing.
export type RestoreResult =
    | { ok: true; id: string; name: string; needsPriceReview: boolean }
    | { ok: false; error: string }

export async function restoreProduct(id: string): Promise<RestoreResult> {
    try {
        const res = await fetch(`/api/provider/products/${id}/restore`, { method: "POST" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return { ok: false, error: data.error || "Could not restore the product" }
        return { ok: true, id: data.product.id, name: data.product.name, needsPriceReview: !!data.needsPriceReview }
    } catch {
        return { ok: false, error: "Something went wrong" }
    }
}

export const PRICE_CHECK_NOTE = "The unit changed while it was in the trash. Check the price."
