// Turns a public id from a request into the database id, only if the row belongs to this shop.
// Null for a malformed id or one that is not the shop's, so routes answer "not found" the same way for both.
import { prisma } from "@/lib/prisma"
import { isPublicId } from "@/lib/shared/public-id"

export async function productIdOf(shopId: string, publicProductId: unknown): Promise<string | null> {
    if (!isPublicId(publicProductId)) return null
    const row = await prisma.product.findFirst({ where: { publicProductId, shopId }, select: { id: true } })
    return row?.id ?? null
}

export async function warehouseIdOf(shopId: string, publicWarehouseId: unknown): Promise<string | null> {
    if (!isPublicId(publicWarehouseId)) return null
    const row = await prisma.warehouse.findFirst({ where: { publicWarehouseId, shopId }, select: { id: true } })
    return row?.id ?? null
}

export async function taxIdOf(shopId: string, publicTaxId: unknown): Promise<string | null> {
    if (!isPublicId(publicTaxId)) return null
    const row = await prisma.taxRate.findFirst({ where: { publicTaxId, shopId }, select: { id: true } })
    return row?.id ?? null
}
