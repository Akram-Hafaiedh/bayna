// tests/api/taxes.test.ts
// Taxes: the routes, and how they keep each product's price with tax (priceTtc) in step. Works in the La Marsa
// shop. Every tax made here is named "api-test-..." and removed afterwards.
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { GET as listTaxes, POST as createTax } from "@/app/api/shop/taxes/route"
import { PATCH as updateTax, DELETE as deleteTax } from "@/app/api/shop/taxes/[id]/route"
import { PATCH as reorderTaxes } from "@/app/api/shop/taxes/reorder/route"
import { POST as createProduct } from "@/app/api/shop/products/route"
import { PATCH as updateProduct } from "@/app/api/shop/products/[id]/route"
import { getProductStats, listProducts } from "@/lib/shops/shop-products"
import { parseProductFilters } from "@/lib/products/product-filters"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { call, cleanUp, demo, prisma, purgeTestProducts, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let marsa = { id: "", publicShopId: "" }

beforeAll(async () => {
    marsa = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.marsa }, select: { id: true, publicShopId: true } })
})
afterEach(async () => {
    signOut()
    await prisma.taxRate.deleteMany({ where: { shopId: marsa.id, name: { startsWith: "api-test-" } } })
})
afterAll(async () => {
    await purgeTestProducts()
    await cleanUp()
})

const asMarsa = () => ({ [SHOP_HEADER]: marsa.publicShopId })
const uniq = () => `api-test-${randomUUID().slice(0, 8)}`
const params = (id: string) => ({ params: { id } })

async function aTax(over: Record<string, unknown> = {}) {
    await signInAs(OWNER)
    const res = await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value: 10, ...over } })
    expect(res.status).toBe(201)
    return (res.json?.tax as { id: string; name: string }).id
}

async function aProduct(price: number, extra: Record<string, unknown> = {}) {
    await signInAs(OWNER)
    const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price, ...extra } })
    expect(res.status).toBe(201)
    return (res.json?.product as { id: string }).id
}

const ttc = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { priceTtc: true } })).priceTtc.toFixed(3)

describe("the taxes routes", () => {
    test("a viewer can read the taxes but not change them", async () => {
        await signInAs(demo("viewer"))
        expect((await call(listTaxes, { method: "GET", headers: asMarsa() })).status).toBe(200)
        expect((await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value: 5 } })).status).toBe(403)
    })

    test("an owner creates a tax: it goes last, and the name is unique ignoring case", async () => {
        const a = await aTax()
        const b = await aTax()
        const [ra, rb] = await Promise.all([a, b].map((id) => prisma.taxRate.findUniqueOrThrow({ where: { id } })))
        expect(rb.sortOrder).toBeGreaterThan(ra.sortOrder)
        const dup = await call(createTax, { headers: asMarsa(), body: { name: ra.name.toUpperCase(), kind: "PERCENTAGE", value: 5 } })
        expect(dup.status).toBe(409)
        expect(await prisma.activityLog.count({ where: { entityType: "TaxRate", entityId: a, action: "CREATE" } })).toBe(1)
    })

    test("bad fields are a 400", async () => {
        await signInAs(OWNER)
        for (const body of [
            { name: "x", kind: "PERCENTAGE", value: 5 },
            { name: uniq(), kind: "PERCENTAGE", value: 0 },
            { name: uniq(), kind: "PERCENTAGE", value: 101 },
            { name: uniq(), kind: "FIXED", value: "0.0005" },
            { name: uniq(), kind: "NOPE", value: 5 },
            { name: uniq(), kind: "PERCENTAGE" },
        ]) {
            expect((await call(createTax, { headers: asMarsa(), body })).status).toBe(400)
        }
    })

    test("the list carries how many products use each tax", async () => {
        const t = await aTax()
        await aProduct(10, { taxIds: [t] })
        const res = await call(listTaxes, { method: "GET", headers: asMarsa() })
        const row = (res.json?.taxes as { id: string; productCount: number }[]).find((x) => x.id === t)
        expect(row?.productCount).toBe(1)
    })

    test("another shop's tax is a 404", async () => {
        const other = await prisma.shop.findFirstOrThrow({ where: { id: { not: marsa.id } }, select: { id: true } })
        const foreign = await prisma.taxRate.create({ data: { shopId: other.id, name: uniq(), kind: "PERCENTAGE", value: 5 } })
        try {
            await signInAs(OWNER)
            expect((await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(foreign.id), body: { name: uniq() } })).status).toBe(404)
            expect((await call(deleteTax, { method: "DELETE", headers: asMarsa(), ...params(foreign.id) })).status).toBe(404)
        } finally {
            await prisma.taxRate.delete({ where: { id: foreign.id } })
        }
    })

    test("reordering needs every tax once", async () => {
        const all = await prisma.taxRate.findMany({ where: { shopId: marsa.id }, select: { id: true } })
        const a = await aTax()
        const b = await aTax()
        const ids = [...all.map((t) => t.id), a, b]
        expect((await call(reorderTaxes, { method: "PATCH", headers: asMarsa(), body: { ids: [a] } })).status).toBe(400)
        const ok = await call(reorderTaxes, { method: "PATCH", headers: asMarsa(), body: { ids: [b, a, ...ids.filter((i) => i !== a && i !== b)] } })
        expect(ok.status).toBe(200)
        const [ra, rb] = await Promise.all([a, b].map((id) => prisma.taxRate.findUniqueOrThrow({ where: { id } })))
        expect(rb.sortOrder).toBeLessThan(ra.sortOrder)
    })
})

describe("the price with tax follows the taxes", () => {
    test("a product with no taxes is priced as it is", async () => {
        const p = await aProduct(12.5)
        expect(await ttc(p)).toBe("12.500")
    })

    test("choosing taxes at creation prices the product", async () => {
        const t = await aTax({ value: 10 })
        const p = await aProduct(100, { taxIds: [t] })
        expect(await ttc(p)).toBe("110.000")
    })

    test("a tax on the running total follows the order of the taxes", async () => {
        const base = await aTax({ value: 10 })
        const running = await aTax({ value: 10, appliesOn: "RUNNING" })
        const p = await aProduct(100, { taxIds: [base, running] })
        // the order is the shop's: base first (sortOrder), then running
        expect(await ttc(p)).toBe("121.000")
        const all = (await prisma.taxRate.findMany({ where: { shopId: marsa.id, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true } })).map((t) => t.id)
        const rest = all.filter((i) => i !== base && i !== running)
        await call(reorderTaxes, { method: "PATCH", headers: asMarsa(), body: { ids: [...rest, running, base] } })
        expect(await ttc(p)).toBe("120.000")
    })

    test("changing the rate prices the products again; so does a fixed amount", async () => {
        const t = await aTax({ value: 10 })
        const f = await aTax({ kind: "FIXED", value: "0.500" })
        const p = await aProduct(100, { taxIds: [t, f] })
        expect(await ttc(p)).toBe("110.500")
        const res = await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(t), body: { value: 20 } })
        expect(res.status).toBe(200)
        expect(await ttc(p)).toBe("120.500")
        await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(f), body: { isActive: false } })
        expect(await ttc(p)).toBe("120.000")
    })

    test("deleting a tax prices its products again without it", async () => {
        const t = await aTax({ value: 10 })
        const p = await aProduct(100, { taxIds: [t] })
        const res = await call(deleteTax, { method: "DELETE", headers: asMarsa(), ...params(t) })
        expect(res.status).toBe(200)
        expect(res.json?.productsChanged).toBe(1)
        expect(await ttc(p)).toBe("100.000")
    })

    test("a new price prices it again", async () => {
        const t = await aTax({ value: 10 })
        const p = await aProduct(100, { taxIds: [t] })
        const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { price: 200 } })
        expect(res.status).toBe(200)
        expect(await ttc(p)).toBe("220.000")
    })

    test("a product is taxed or exempt, never both; exempt clears its taxes", async () => {
        const t = await aTax({ value: 10 })
        const p = await aProduct(100, { taxIds: [t] })
        const both = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxIds: [t], taxExempt: true } })
        expect(both.status).toBe(400)
        const ex = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxExempt: true } })
        expect(ex.status).toBe(200)
        expect(await prisma.productTax.count({ where: { productId: p } })).toBe(0)
        expect(await ttc(p)).toBe("100.000")
        // choosing a tax again lifts the exemption
        await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxIds: [t] } })
        expect((await prisma.product.findUniqueOrThrow({ where: { id: p } })).taxExempt).toBe(false)
        expect(await ttc(p)).toBe("110.000")
    })

    test("a tax from another shop cannot be chosen", async () => {
        const other = await prisma.shop.findFirstOrThrow({ where: { id: { not: marsa.id } }, select: { id: true } })
        const foreign = await prisma.taxRate.create({ data: { shopId: other.id, name: uniq(), kind: "PERCENTAGE", value: 5 } })
        try {
            const p = await aProduct(10)
            const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxIds: [foreign.id] } })
            expect(res.status).toBe(404)
            expect(await ttc(p)).toBe("10.000")
        } finally {
            await prisma.taxRate.delete({ where: { id: foreign.id } })
        }
    })

    test("someone without price rights cannot change taxes", async () => {
        const t = await aTax()
        const p = await aProduct(10)
        await signInAs(demo("viewer"))
        const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxIds: [t] } })
        expect([403, 404]).toContain(res.status)
    })
})

describe("tax to set", () => {
    const unset = async () => (await listProducts(marsa.id, parseProductFilters(new URLSearchParams("tax=unset&q=api-test-&pageSize=100")))).items.map((p) => p.id)

    test("a product with no tax chosen is listed, one with a tax or marked exempt is not", async () => {
        const t = await aTax()
        const none = await aProduct(10)
        const taxed = await aProduct(10, { taxIds: [t] })
        const exempt = await aProduct(10, { taxExempt: true })
        const ids = await unset()
        expect(ids).toContain(none)
        expect(ids).not.toContain(taxed)
        expect(ids).not.toContain(exempt)
        const rows = (await listProducts(marsa.id, parseProductFilters(new URLSearchParams("q=api-test-&pageSize=100")))).items
        const state = (id: string) => rows.find((r) => r.id === id)?.taxState
        expect([state(none), state(taxed), state(exempt)]).toEqual(["UNSET", "TAXED", "EXEMPT"])
    })

    test("a product whose only tax is switched off is to set again, and the count follows", async () => {
        const t = await aTax()
        const p = await aProduct(10, { taxIds: [t] })
        const before = (await getProductStats(marsa.id)).taxToSet
        expect(await unset()).not.toContain(p)
        await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(t), body: { isActive: false } })
        expect(await unset()).toContain(p)
        expect((await getProductStats(marsa.id)).taxToSet).toBe(before + 1)
    })

    test("leaving exempt with no tax makes it to set; the form sends both fields to do that", async () => {
        const p = await aProduct(10, { taxExempt: true })
        expect(await unset()).not.toContain(p)
        const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { taxIds: [], taxExempt: false } })
        expect(res.status).toBe(200)
        expect(await unset()).toContain(p)
    })
})
