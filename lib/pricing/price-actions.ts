// lib/pricing/price-actions.ts
// The database side of taxes. Every function takes the transaction from withAudit, so a tax change and the
// prices it changes commit together. The arithmetic is in price-rules.ts.
//
// Product.priceTtc is kept equal to computePrice(price, the product's active taxes in the shop's order).
// Only this file writes it: after a price change call recomputeProducts, after a tax change the functions
// below do it themselves.
import type { Tx } from "@/lib/audit/run"
import { computePrice, type TaxData, type TaxInput } from "@/lib/pricing/price-rules"

/** A refusal the person can fix. The API turns it into a response with this status. */
export class PricingError extends Error {
    status: number
    constructor(message: string, status = 409) {
        super(message)
        this.name = "PricingError"
        this.status = status
    }
}

/** The shop's active taxes in the order they apply. */
async function activeTaxes(tx: Tx, shopId: string): Promise<TaxInput[]> {
    const rows = await tx.taxRate.findMany({
        where: { shopId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true, name: true, kind: true, value: true, appliesOn: true },
    })
    return rows.map((t) => ({ id: t.id, name: t.name, kind: t.kind, value: t.value.toString(), appliesOn: t.appliesOn }))
}

/**
 * Work out and store the price with tax of some products of a shop (all of them when no ids are given).
 * Returns how many rows changed. Products in the Trash are kept in step too, so a restore needs nothing.
 */
export async function recomputeProducts(tx: Tx, shopId: string, productIds?: string[]): Promise<number> {
    if (productIds && productIds.length === 0) return 0
    const taxes = await activeTaxes(tx, shopId)
    const products = await tx.product.findMany({
        where: { shopId, ...(productIds ? { id: { in: productIds } } : {}) },
        select: { id: true, price: true, priceTtc: true, taxExempt: true, taxes: { select: { taxRateId: true } } },
    })
    let changed = 0
    for (const p of products) {
        const carried = new Set(p.taxes.map((t) => t.taxRateId))
        const applying = p.taxExempt ? [] : taxes.filter((t) => carried.has(t.id))
        const next = computePrice(p.price.toString(), applying).total
        if (next !== p.priceTtc.toFixed(3)) {
            await tx.product.update({ where: { id: p.id }, data: { priceTtc: next } })
            changed++
        }
    }
    return changed
}

/** Product ids that carry a tax. */
async function productsWithTax(tx: Tx, taxRateId: string): Promise<string[]> {
    const rows = await tx.productTax.findMany({ where: { taxRateId }, select: { productId: true } })
    return rows.map((r) => r.productId)
}

/**
 * Choose the taxes of a product, or mark it exempt. `taxIds` and `exempt` exclude each other: exempt means
 * no tax, so choosing taxes clears it and marking exempt clears the taxes. Leave one of them undefined to leave
 * that part as it is.
 */
export async function setProductTaxes(tx: Tx, a: { shopId: string; productId: string; taxIds?: string[]; exempt?: boolean }): Promise<void> {
    const product = await tx.product.findFirst({ where: { id: a.productId, shopId: a.shopId }, select: { id: true } })
    if (!product) throw new PricingError("Product not found", 404)
    const ids = a.taxIds ? [...new Set(a.taxIds)] : undefined
    if (ids && a.exempt === true && ids.length > 0) throw new PricingError("A tax-exempt product cannot carry taxes", 400)
    if (ids && ids.length > 0) {
        const found = await tx.taxRate.count({ where: { shopId: a.shopId, id: { in: ids } } })
        if (found !== ids.length) throw new PricingError("Tax not found", 404)
    }
    if (a.exempt === true) {
        await tx.productTax.deleteMany({ where: { productId: a.productId } })
        await tx.product.update({ where: { id: a.productId }, data: { taxExempt: true } })
    } else if (ids !== undefined) {
        await tx.productTax.deleteMany({ where: { productId: a.productId, taxRateId: { notIn: ids } } })
        const have = new Set((await tx.productTax.findMany({ where: { productId: a.productId }, select: { taxRateId: true } })).map((r) => r.taxRateId))
        const add = ids.filter((id) => !have.has(id))
        if (add.length > 0) await tx.productTax.createMany({ data: add.map((taxRateId) => ({ productId: a.productId, taxRateId })) })
        if (ids.length > 0 || a.exempt === false) await tx.product.update({ where: { id: a.productId }, data: { taxExempt: false } })
    } else if (a.exempt === false) {
        await tx.product.update({ where: { id: a.productId }, data: { taxExempt: false } })
    }
    await recomputeProducts(tx, a.shopId, [a.productId])
}

// ---- the shop's taxes ------------------------------------------------------------------------------

export async function createTax(tx: Tx, shopId: string, d: Required<Pick<TaxData, "name" | "kind" | "value">> & TaxData) {
    if (await tx.taxRate.findFirst({ where: { shopId, name: { equals: d.name, mode: "insensitive" } }, select: { id: true } })) {
        throw new PricingError("You already have a tax with this name")
    }
    const last = await tx.taxRate.aggregate({ where: { shopId }, _max: { sortOrder: true } })
    return tx.taxRate.create({
        data: {
            shopId, name: d.name, kind: d.kind, value: d.value, appliesOn: d.appliesOn ?? "BASE",
            isActive: d.isActive ?? true, sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
    })
}

async function ownTax(tx: Tx, shopId: string, id: string) {
    const t = await tx.taxRate.findFirst({ where: { id, shopId } })
    if (!t) throw new PricingError("Tax not found", 404)
    return t
}

/** Edit a tax. Every product that carries it gets its price with tax worked out again. */
export async function updateTax(tx: Tx, shopId: string, id: string, d: TaxData) {
    await ownTax(tx, shopId, id)
    if (d.name !== undefined) {
        const same = await tx.taxRate.findFirst({ where: { shopId, id: { not: id }, name: { equals: d.name, mode: "insensitive" } }, select: { id: true } })
        if (same) throw new PricingError("You already have a tax with this name")
    }
    const updated = await tx.taxRate.update({ where: { id }, data: d })
    await recomputeProducts(tx, shopId, await productsWithTax(tx, id))
    return updated
}

/** Delete a tax; the products that carried it are worked out again without it. */
export async function deleteTax(tx: Tx, shopId: string, id: string): Promise<{ productsChanged: number }> {
    await ownTax(tx, shopId, id)
    const affected = await productsWithTax(tx, id)
    await tx.taxRate.delete({ where: { id } }) // its ProductTax rows go with it
    return { productsChanged: await recomputeProducts(tx, shopId, affected) }
}

/** Put the shop's taxes in this order (every tax of the shop, once). Prices that depend on the order change. */
export async function reorderTaxes(tx: Tx, shopId: string, orderedIds: string[]): Promise<void> {
    const all = await tx.taxRate.findMany({ where: { shopId }, select: { id: true } })
    const known = new Set(all.map((t) => t.id))
    if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !known.has(id))) {
        throw new PricingError("Send every tax of the shop once, in the order you want", 400)
    }
    for (const [i, id] of orderedIds.entries()) await tx.taxRate.update({ where: { id }, data: { sortOrder: i } })
    await recomputeProducts(tx, shopId) // the order can change any product that has two or more taxes
}
