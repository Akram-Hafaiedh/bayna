// What an API response shows of a warehouse: `id` is the public id, and nothing that names the database row
// or who touched it.
type WithIds = { id: string; publicWarehouseId: string }
type Hidden = "publicWarehouseId" | "shopId" | "createdById" | "updatedById"

export function warehouseDto<T extends WithIds>(w: T): Omit<T, "id" | Hidden> & { id: string } {
    const out: Record<string, unknown> = { ...w, id: w.publicWarehouseId }
    for (const k of ["publicWarehouseId", "shopId", "createdById", "updatedById"]) delete out[k]
    return out as Omit<T, "id" | Hidden> & { id: string }
}
