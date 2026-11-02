// lib/products/product-clone.ts
// What a copy of a product is called. Pure (unit tested); the copy itself is made by
// app/api/shop/products/[id]/clone/route.ts.
const SUFFIX = " (copy)"
const MAX_NAME = 200

/** "Cement 50 kg" -> "Cement 50 kg (copy)"; a long name is cut so the copy still fits the 200 characters of a name. */
export function cloneName(name: string): string {
    const base = name.trim()
    if (base.length + SUFFIX.length <= MAX_NAME) return base + SUFFIX
    return base.slice(0, MAX_NAME - SUFFIX.length).trimEnd() + SUFFIX
}
