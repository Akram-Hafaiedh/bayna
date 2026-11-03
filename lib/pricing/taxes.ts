// lib/pricing/taxes.ts
// Reads for the tax screens and API: the shop's taxes in the order they apply, with how many products carry each.
// Writes are in price-actions.ts.
import { prisma } from "@/lib/prisma"
import { publicIds } from "@/lib/shared/public-id"
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
        id: t.publicTaxId, name: t.name, kind: t.kind, value: t.value.toString(), appliesOn: t.appliesOn,
        sortOrder: t.sortOrder, isActive: t.isActive, productCount: t._count.products,
    }))
}

/**
 * The internal ids of the taxes a request names by public id. Null when one is malformed or is not one of this
 * shop's taxes, so a product can never carry another shop's tax.
 */
export async function resolveTaxIds(shopId: string, asked: string[]): Promise<string[] | null> {
    const ids = publicIds(asked)
    if (ids.length !== asked.length) return null
    if (ids.length === 0) return []
    const rows = await prisma.taxRate.findMany({ where: { publicTaxId: { in: ids }, shopId }, select: { id: true } })
    return rows.length === new Set(ids).size ? rows.map((r) => r.id) : null
}

/** What an API response shows of a tax: the public id as `id`, the value as text, nothing that names the row or who touched it. */
export function taxDto(t: { publicTaxId: string; name: string; kind: TaxKindValue; value: { toString(): string }; appliesOn: TaxAppliesOnValue; sortOrder: number; isActive: boolean }) {
    return { id: t.publicTaxId, name: t.name, kind: t.kind, value: t.value.toString(), appliesOn: t.appliesOn, sortOrder: t.sortOrder, isActive: t.isActive }
}
