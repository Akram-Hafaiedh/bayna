// What an API response shows of a product: `id` is the public id, and nothing that names the database
// row or who touched it. Use this for every product a route returns.
type WithIds = { id: string; publicProductId: string }
type Hidden = "publicProductId" | "shopId" | "createdById" | "updatedById" | "deletedById"

export function productDto<T extends WithIds>(p: T): Omit<T, "id" | Hidden> & { id: string } {
    const out: Record<string, unknown> = { ...p, id: p.publicProductId }
    for (const k of ["publicProductId", "shopId", "createdById", "updatedById", "deletedById"]) delete out[k]
    return out as Omit<T, "id" | Hidden> & { id: string }
}
