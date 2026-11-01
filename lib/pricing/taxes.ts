// lib/pricing/taxes.ts
// Reads for the tax screens and API: the shop's taxes in the order they apply, with how many products carry each.
// Writes are in price-actions.ts.
import { prisma } from "@/lib/prisma"
import type { TaxAppliesOnValue, TaxKindValue } from "@/lib/pricing/price-rules"

export type TaxRow = {
    id: string
    name: string
    kind: TaxKindValue
    /** Percentage or TND amount, as text so no precision is lost */
    value: string
    appliesOn: TaxAppliesOnValue
    sortOrder: number
    isActive: boolean
    productCount: number
}

export async function listTaxes(shopId: string): Promise<TaxRow[]> {
    const rows = await prisma.taxRate.findMany({
        where: { shopId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: { _count: { select: { products: true } } },
    })
    return rows.map((t) => ({
        id: t.id, name: t.name, kind: t.kind, value: t.value.toString(), appliesOn: t.appliesOn,
        sortOrder: t.sortOrder, isActive: t.isActive, productCount: t._count.products,
    }))
}
