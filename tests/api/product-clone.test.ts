// tests/api/product-clone.test.ts
// "Make a copy" of a product: a draft with the same offer and taxes, no stock, no SKU, no catalogue link.
// Works in the La Marsa shop; test products are named "api-test-...".
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { POST as createTax } from "@/app/api/shop/taxes/route"
import { POST as createProduct } from "@/app/api/shop/products/route"
import { PATCH as updateProduct } from "@/app/api/shop/products/[id]/route"
import { POST as cloneProduct } from "@/app/api/shop/products/[id]/clone/route"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { call, cleanUp, demo, prisma, purgeTestProducts, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let marsa = { id: "", publicShopId: "" }
const toPurge: string[] = []

beforeAll(async () => {
    marsa = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.marsa }, select: { id: true, publicShopId: true } })
})
afterEach(async () => {
    signOut()
    await prisma.taxRate.deleteMany({ where: { shopId: marsa.id, name: { startsWith: "api-test-" } } })
    if (toPurge.length) await purgeTestProducts({ id: { in: toPurge.splice(0) } })
})
afterAll(async () => {
    await purgeTestProducts()
    await cleanUp()
})

const asMarsa = () => ({ [SHOP_HEADER]: marsa.publicShopId })
const uniq = () => `api-test-${randomUUID().slice(0, 8)}`
const params = (id: string) => ({ params: { id } })

async function aProduct(extra: Record<string, unknown> = {}) {
    await signInAs(OWNER)
    const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 100, stock: 7, sku: "REF-1", brand: "Acme", description: "Grey", minOrderQty: 5, ...extra } })
    expect(res.status).toBe(201)
    return (res.json?.product as { id: string; name: string }).id
}
async function copyOf(id: string) {
    await signInAs(OWNER)
    const res = await call(cloneProduct, { headers: asMarsa(), ...params(id) })
    expect(res.status).toBe(201)
    const copy = res.json?.product as { id: string; name: string }
    toPurge.push(copy.id)
    return copy
}

describe("make a copy", () => {
    test("is a draft with the same offer, and none of the stock, SKU or catalogue link", async () => {
        const source = await aProduct()
        const before = await prisma.product.findUniqueOrThrow({ where: { id: source } })
        const copy = await copyOf(source)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: copy.id } })
        expect(copy.name).toBe(`${before.name} (copy)`)
        expect(row).toMatchObject({
            shopId: marsa.id, status: "DRAFT", brand: "Acme", description: "Grey", minOrderQty: 5, unit: before.unit,
            categoryId: before.categoryId, stock: 0, sku: null, catalogItemId: null, deletedAt: null,
        })
        expect(row.price.toFixed(3)).toBe("100.000")
        expect(row.priceUpdatedAt).not.toBeNull()
        // the original is untouched
        const after = await prisma.product.findUniqueOrThrow({ where: { id: source } })
        expect(after).toMatchObject({ stock: 7, sku: "REF-1", status: before.status })
        // no stock history for the copy
        expect(await prisma.stockMovement.count({ where: { productId: copy.id } })).toBe(0)
    })

    test("carries the same taxes, and has its own price history starting at its price with tax", async () => {
        await signInAs(OWNER)
        const t = await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value: 10 } })
        const taxId = (t.json?.tax as { id: string }).id
        const source = await aProduct({ taxIds: [taxId] })
        const copy = await copyOf(source)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: copy.id }, include: { taxes: true } })
        expect(row.taxes.map((x) => x.taxRateId)).toEqual([taxId])
        expect(row.priceTtc.toFixed(3)).toBe("110.000")
        const history = await prisma.priceHistory.findMany({ where: { productId: copy.id } })
        expect(history.map((h) => [h.reason, h.price.toFixed(3), h.priceTtc.toFixed(3)])).toEqual([["INITIAL", "100.000", "110.000"]])
    })

    test("a tax-exempt product gives a tax-exempt copy; one with no tax chosen stays to set", async () => {
        const exempt = await aProduct({ taxExempt: true })
        const unset = await aProduct()
        const a = await prisma.product.findUniqueOrThrow({ where: { id: (await copyOf(exempt)).id }, include: { taxes: true } })
        const b = await prisma.product.findUniqueOrThrow({ where: { id: (await copyOf(unset)).id }, include: { taxes: true } })
        expect([a.taxExempt, a.taxes.length]).toEqual([true, 0])
        expect([b.taxExempt, b.taxes.length]).toEqual([false, 0])
    })

    test("a copy of a catalogue product is a custom product, since a shop lists a catalogue item once", async () => {
        const linked = await prisma.product.findFirst({ where: { shopId: marsa.id, catalogItemId: { not: null }, deletedAt: null, price: { gt: 0 } } })
        if (!linked) return // the demo shop has no catalogue product: nothing to check
        const copy = await copyOf(linked.id)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: copy.id } })
        expect(row.catalogItemId).toBeNull()
        expect(row.unit).toBe(linked.unit)
        expect(row.categoryId).toBe(linked.categoryId)
    })

    test("the copy can be edited and copied again", async () => {
        const source = await aProduct()
        const copy = await copyOf(source)
        const renamed = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(copy.id), body: { name: uniq(), status: "ACTIVE" } })
        expect(renamed.status).toBe(200)
        const again = await copyOf(copy.id)
        expect(again.id).not.toBe(copy.id)
    })
})

describe("who can copy", () => {
    test("a viewer cannot", async () => {
        const source = await aProduct()
        await signInAs(demo("viewer"))
        expect((await call(cloneProduct, { headers: asMarsa(), ...params(source) })).status).toBe(403)
    })

    test("someone who cannot set prices cannot copy a priced product", async () => {
        // the inventory clerk of the Tunis shop may create listings but not set prices
        const tunis = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { id: true, publicShopId: true } })
        const priced = await prisma.product.findFirst({ where: { shopId: tunis.id, deletedAt: null, price: { gt: 0 } }, select: { id: true } })
        if (!priced) return
        await signInAs(demo("inventory"))
        const before = await prisma.product.count({ where: { shopId: tunis.id } })
        expect((await call(cloneProduct, { headers: { [SHOP_HEADER]: tunis.publicShopId }, ...params(priced.id) })).status).toBe(403)
        expect(await prisma.product.count({ where: { shopId: tunis.id } })).toBe(before)
    })

    test("a product of another shop, or one in the Trash, is a 404", async () => {
        const source = await aProduct()
        const other = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { publicShopId: true } })
        await signInAs(OWNER)
        expect((await call(cloneProduct, { headers: { [SHOP_HEADER]: other.publicShopId }, ...params(source) })).status).toBe(404)
        await prisma.product.update({ where: { id: source }, data: { deletedAt: new Date() } })
        expect((await call(cloneProduct, { headers: asMarsa(), ...params(source) })).status).toBe(404)
    })
})
