// tests/api/public-ids.test.ts
// Products, warehouses and taxes are named by their public id in every link, request and response; the database
// id never leaves the server, and using it as an id gets a 404. Works in the La Marsa shop.
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { GET as listProducts, POST as createProduct } from "@/app/api/shop/products/route"
import { GET as getProduct, PATCH as updateProduct } from "@/app/api/shop/products/[id]/route"
import { POST as cloneProduct } from "@/app/api/shop/products/[id]/clone/route"
import { GET as getHistory } from "@/app/api/shop/products/[id]/price-history/route"
import { GET as listWarehouses, POST as createWarehouse } from "@/app/api/shop/warehouses/route"
import { PATCH as updateWarehouse } from "@/app/api/shop/warehouses/[id]/route"
import { GET as listTaxes, POST as createTax } from "@/app/api/shop/taxes/route"
import { PATCH as updateTax } from "@/app/api/shop/taxes/[id]/route"
import { POST as moveStock } from "@/app/api/shop/stock/route"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { PUBLIC_ID_RE } from "@/lib/shared/public-id"
import { call, cleanUp, prisma, purgeTestProducts, purgeTestWarehouses, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let marsa = { id: "", publicShopId: "" }

beforeAll(async () => {
    marsa = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.marsa }, select: { id: true, publicShopId: true } })
})
afterEach(async () => {
    signOut()
    await prisma.taxRate.deleteMany({ where: { shopId: marsa.id, name: { startsWith: "api-test-" } } })
    await purgeTestWarehouses({ shopId: marsa.id, name: { startsWith: "api-test-" } })
})
afterAll(async () => {
    await purgeTestProducts()
    await cleanUp()
})

const asMarsa = () => ({ [SHOP_HEADER]: marsa.publicShopId })
const uniq = () => `api-test-${randomUUID().slice(0, 8)}`
const params = (id: string) => ({ params: { id } })
const INTERNAL_KEYS = ["shopId", "createdById", "updatedById", "deletedById", "publicProductId", "publicWarehouseId", "publicTaxId"]

describe("products", () => {
    test("a new product comes back with a public id and no database fields", async () => {
        await signInAs(OWNER)
        const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5, stock: 2 } })
        expect(res.status).toBe(201)
        const product = res.json?.product as Record<string, unknown>
        expect(String(product.id)).toMatch(PUBLIC_ID_RE)
        for (const k of INTERNAL_KEYS) expect(product, k).not.toHaveProperty(k)
        const row = await prisma.product.findUniqueOrThrow({ where: { publicProductId: String(product.id) } })
        expect(row.id).not.toBe(product.id)
    })

    test("the database id is not an id: read, edit, copy and history all say 404", async () => {
        await signInAs(OWNER)
        const made = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5 } })
        const publicProductId = String((made.json?.product as { id: string }).id)
        const row = await prisma.product.findUniqueOrThrow({ where: { publicProductId } })
        expect((await call(getProduct, { method: "GET", headers: asMarsa(), ...params(row.id) })).status).toBe(404)
        expect((await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(row.id), body: { price: 6 } })).status).toBe(404)
        expect((await call(cloneProduct, { headers: asMarsa(), ...params(row.id) })).status).toBe(404)
        expect((await call(getHistory, { method: "GET", headers: asMarsa(), ...params(row.id) })).status).toBe(404)
        expect((await call(getProduct, { method: "GET", headers: asMarsa(), ...params(publicProductId) })).status).toBe(200)
    })

    test("the list and the copy show public ids too", async () => {
        await signInAs(OWNER)
        const made = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5 } })
        const id = String((made.json?.product as { id: string }).id)
        const list = await call(listProducts, { method: "GET", headers: asMarsa(), url: "http://localhost/api/shop/products?pageSize=100" })
        for (const p of list.json?.products as { id: string }[]) expect(p.id).toMatch(PUBLIC_ID_RE)
        const copy = await call(cloneProduct, { headers: asMarsa(), ...params(id) })
        expect(String((copy.json?.product as { id: string }).id)).toMatch(PUBLIC_ID_RE)
    })

    test("taxes are chosen by public id; a database id is refused", async () => {
        await signInAs(OWNER)
        const t = await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value: 10 } })
        const tax = t.json?.tax as { id: string }
        const row = await prisma.taxRate.findUniqueOrThrow({ where: { publicTaxId: tax.id } })
        const bad = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 10, taxIds: [row.id] } })
        expect(bad.status).toBe(404)
        const ok = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 10, taxIds: [tax.id] } })
        expect(ok.status).toBe(201)
        expect(Number((ok.json?.product as { priceTtc: string }).priceTtc)).toBe(11)
    })
})

describe("warehouses", () => {
    test("a warehouse has a public id, and the database id is a 404", async () => {
        await signInAs(OWNER)
        const res = await call(createWarehouse, { headers: asMarsa(), body: { name: uniq(), city: "La Marsa", governorate: "Tunis" } })
        expect(res.status).toBe(201)
        const w = res.json?.warehouse as Record<string, unknown>
        expect(String(w.id)).toMatch(PUBLIC_ID_RE)
        for (const k of INTERNAL_KEYS) expect(w, k).not.toHaveProperty(k)
        const row = await prisma.warehouse.findUniqueOrThrow({ where: { publicWarehouseId: String(w.id) } })
        expect((await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(row.id), body: { name: uniq() } })).status).toBe(404)
        const list = await call(listWarehouses, { method: "GET", headers: asMarsa() })
        for (const x of list.json?.warehouses as { id: string }[]) expect(x.id).toMatch(PUBLIC_ID_RE)
    })

    test("stock requests name the product and warehouse by public id only", async () => {
        await signInAs(OWNER)
        const p = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5, stock: 3 } })
        const productId = String((p.json?.product as { id: string }).id)
        const wh = await prisma.warehouse.findFirstOrThrow({ where: { shopId: marsa.id, isDefault: true }, select: { id: true, publicWarehouseId: true } })
        const product = await prisma.product.findUniqueOrThrow({ where: { publicProductId: productId }, select: { id: true } })
        const body = (a: string, b: string) => ({ productId: a, warehouseId: b, type: "RECEIVED", quantity: 1, reasonCode: "SUPPLIER_DELIVERY" })
        expect((await call(moveStock, { headers: asMarsa(), body: body(product.id, wh.publicWarehouseId) })).status).toBe(404)
        expect((await call(moveStock, { headers: asMarsa(), body: body(productId, wh.id) })).status).toBe(404)
        expect((await call(moveStock, { headers: asMarsa(), body: body(productId, wh.publicWarehouseId) })).status).toBe(201)
    })
})

describe("taxes", () => {
    test("a tax has a public id, and the database id is a 404", async () => {
        await signInAs(OWNER)
        const res = await call(createTax, { headers: asMarsa(), body: { name: uniq(), kind: "PERCENTAGE", value: 7 } })
        expect(res.status).toBe(201)
        const tax = res.json?.tax as Record<string, unknown>
        expect(String(tax.id)).toMatch(PUBLIC_ID_RE)
        for (const k of INTERNAL_KEYS) expect(tax, k).not.toHaveProperty(k)
        const row = await prisma.taxRate.findUniqueOrThrow({ where: { publicTaxId: String(tax.id) } })
        expect((await call(updateTax, { method: "PATCH", headers: asMarsa(), ...params(row.id), body: { value: 8 } })).status).toBe(404)
        const list = await call(listTaxes, { method: "GET", headers: asMarsa() })
        for (const x of list.json?.taxes as { id: string }[]) expect(x.id).toMatch(PUBLIC_ID_RE)
    })
})
