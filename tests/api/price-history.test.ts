// tests/api/price-history.test.ts
// The price history: a row for each change of a product's price or price with tax, written with the change,
// never edited or deleted. Works in the La Marsa shop; test products are named "api-test-...".
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { POST as createTax } from "@/app/api/shop/taxes/route"
import { PATCH as updateTax } from "@/app/api/shop/taxes/[id]/route"
import { POST as createProduct } from "@/app/api/shop/products/route"
import { PATCH as updateProduct } from "@/app/api/shop/products/[id]/route"
import { GET as getHistory } from "@/app/api/shop/products/[id]/price-history/route"
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

async function aTax(value = 10) {
    await signInAs(OWNER)
    const res = await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value } })
    expect(res.status).toBe(201)
    return (res.json?.tax as { id: string }).id
}
async function aProduct(price: number, extra: Record<string, unknown> = {}) {
    await signInAs(OWNER)
    const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price, ...extra } })
    expect(res.status).toBe(201)
    return (res.json?.product as { id: string }).id
}
const patch = (id: string, body: Record<string, unknown>) => call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(id), body })
const rows = async (productId: string) =>
    (await prisma.priceHistory.findMany({ where: { productId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })).map((r) => ({
        price: r.price.toFixed(3), ttc: r.priceTtc.toFixed(3), reason: r.reason,
    }))

describe("what is recorded", () => {
    test("a new product starts with one row: its first price", async () => {
        const p = await aProduct(100)
        expect(await rows(p)).toEqual([{ price: "100.000", ttc: "100.000", reason: "INITIAL" }])
    })

    test("a new product with taxes starts with one row that already has the price with tax", async () => {
        const t = await aTax(10)
        const p = await aProduct(100, { taxIds: [t] })
        expect(await rows(p)).toEqual([{ price: "100.000", ttc: "110.000", reason: "INITIAL" }])
    })

    test("a new price adds a row; the same price again adds nothing", async () => {
        const p = await aProduct(100)
        expect((await patch(p, { price: 120 })).status).toBe(200)
        expect(await rows(p)).toEqual([
            { price: "100.000", ttc: "100.000", reason: "INITIAL" },
            { price: "120.000", ttc: "120.000", reason: "PRICE" },
        ])
        await patch(p, { price: 120 })
        await patch(p, { name: `${uniq()}` })
        expect((await rows(p)).length).toBe(2)
    })

    test("choosing a tax adds a row with only the price with tax moved", async () => {
        const t = await aTax(10)
        const p = await aProduct(100)
        await patch(p, { taxIds: [t] })
        expect(await rows(p)).toEqual([
            { price: "100.000", ttc: "100.000", reason: "INITIAL" },
            { price: "100.000", ttc: "110.000", reason: "TAX" },
        ])
    })

    test("a price and a tax changed in one save are one row", async () => {
        const t = await aTax(10)
        const p = await aProduct(100)
        await patch(p, { price: 200, taxIds: [t] })
        expect(await rows(p)).toEqual([
            { price: "100.000", ttc: "100.000", reason: "INITIAL" },
            { price: "200.000", ttc: "220.000", reason: "PRICE" },
        ])
    })

    test("changing a rate adds a row to every product that carries the tax, and to no other", async () => {
        const t = await aTax(10)
        const carrier = await aProduct(100, { taxIds: [t] })
        const other = await aProduct(100)
        await signInAs(OWNER)
        expect((await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(t), body: { value: 20 } })).status).toBe(200)
        expect(await rows(carrier)).toEqual([
            { price: "100.000", ttc: "110.000", reason: "INITIAL" },
            { price: "100.000", ttc: "120.000", reason: "TAX" },
        ])
        expect((await rows(other)).length).toBe(1)
    })

    test("the person who made the change is recorded", async () => {
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER }, select: { id: true } })
        const p = await aProduct(100)
        await patch(p, { price: 110 })
        const last = await prisma.priceHistory.findFirstOrThrow({ where: { productId: p }, orderBy: { createdAt: "desc" } })
        expect(last.createdById).toBe(owner.id)
    })
})

describe("the history is append-only", () => {
    test("a row cannot be edited or deleted", async () => {
        const p = await aProduct(100)
        const row = await prisma.priceHistory.findFirstOrThrow({ where: { productId: p } })
        await expect(prisma.priceHistory.update({ where: { id: row.id }, data: { reason: "TAX" } })).rejects.toThrow(/append-only/)
        await expect(prisma.priceHistory.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/)
        expect(await prisma.priceHistory.count({ where: { productId: p } })).toBe(1)
    })

    test("a reason the app does not know is refused by the database", async () => {
        const p = await aProduct(100)
        await expect(prisma.priceHistory.create({ data: { shopId: marsa.id, productId: p, price: 1, priceTtc: 1, reason: "WHATEVER" } })).rejects.toThrow()
    })
})

describe("the history route", () => {
    test("lists the rows newest first, with how the price moved", async () => {
        const p = await aProduct(100)
        await patch(p, { price: 150 })
        await signInAs(OWNER)
        const res = await call(getHistory, { method: "GET", headers: asMarsa(), ...params(p) })
        expect(res.status).toBe(200)
        const list = res.json?.rows as { price: string; reason: string; change: { direction: string; amount: string } }[]
        expect(list.map((r) => r.price)).toEqual(["150.000", "100.000"])
        expect(list[0]).toMatchObject({ reason: "PRICE", change: { direction: "up", amount: "50.000" } })
        expect(list[1]).toMatchObject({ reason: "INITIAL", change: { direction: "first" } })
        expect(res.json?.total).toBe(2)
    })

    test("a viewer can read it; a product of another shop is a 404", async () => {
        const p = await aProduct(100)
        await signInAs(demo("viewer"))
        expect((await call(getHistory, { method: "GET", headers: asMarsa(), ...params(p) })).status).toBe(200)
        const other = await prisma.shop.findFirstOrThrow({ where: { id: { not: marsa.id }, name: SHOP_NAMES.tunis }, select: { publicShopId: true } })
        await signInAs(OWNER)
        expect((await call(getHistory, { method: "GET", headers: { [SHOP_HEADER]: other.publicShopId }, ...params(p) })).status).toBe(404)
    })
})
