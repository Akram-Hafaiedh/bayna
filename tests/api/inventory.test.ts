// tests/api/inventory.test.ts
// Warehouses and stock: the warehouse routes, manual movements (received / adjusted / counted), transfers, the
// stock history, and how product create / edit go through the ledger. Works in the La Marsa shop, so the
// Carthage shop's products tests are not disturbed. Each test starts with one warehouse (the default).
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { GET as listWarehouses, POST as createWarehouse } from "@/app/api/shop/warehouses/route"
import { PATCH as updateWarehouse, DELETE as deleteWarehouse } from "@/app/api/shop/warehouses/[id]/route"
import { POST as moveStock } from "@/app/api/shop/stock/route"
import { PATCH as setReorder } from "@/app/api/shop/stock/reorder/route"
import { POST as transfer } from "@/app/api/shop/stock/transfer/route"
import { GET as listMovements } from "@/app/api/shop/stock/movements/route"
import { POST as createProduct } from "@/app/api/shop/products/route"
import { PATCH as updateProduct } from "@/app/api/shop/products/[id]/route"
import { ensureDefaultWarehouse } from "@/lib/inventory/stock-actions"
import { listInventory, inventoryCounts } from "@/lib/inventory/inventory-view"
import { parseInventoryQuery } from "@/lib/inventory/inventory-query"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { call, cleanUp, demo, prisma, purgeTestProducts, purgeTestWarehouses, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let marsa = { id: "", publicShopId: "" }
let main = { id: "" } // the default warehouse of the shop

beforeAll(async () => {
    marsa = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.marsa }, select: { id: true, publicShopId: true } })
    main = await prisma.$transaction((tx) => ensureDefaultWarehouse(tx, marsa.id))
})

afterEach(async () => {
    signOut()
    await purgeTestWarehouses({ shopId: marsa.id, name: { startsWith: "api-test-" } })
})
afterAll(async () => {
    await purgeTestProducts()
    await cleanUp()
})

const asMarsa = () => ({ [SHOP_HEADER]: marsa.publicShopId })
const uniq = () => `api-test-${randomUUID().slice(0, 8)}`
const params = (id: string) => ({ params: { id } })

const place = (over: Record<string, unknown> = {}) => ({ name: uniq(), city: "La Marsa", governorate: "Tunis", ...over })

async function aWarehouse(over: Record<string, unknown> = {}) {
    await signInAs(OWNER)
    const res = await call(createWarehouse, { headers: asMarsa(), body: place(over) })
    expect(res.status).toBe(201)
    return (res.json?.warehouse as { id: string }).id
}

/** A product with `stock` units in the default warehouse, made through the routes. */
async function aProduct(stock = 10) {
    await signInAs(OWNER)
    const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5, stock } })
    expect(res.status).toBe(201)
    return (res.json?.product as { id: string }).id
}

const level = async (productId: string, warehouseId: string) =>
    (await prisma.stockLevel.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } }))?.quantity ?? 0
const total = async (productId: string) => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock

describe("warehouses", () => {
    test("the list needs someone who works in the shop; a viewer may read it", async () => {
        signOut()
        expect((await call(listWarehouses, { method: "GET", headers: asMarsa() })).status).toBe(401)
        await signInAs(demo("manager-tunis"))
        expect((await call(listWarehouses, { method: "GET", headers: asMarsa() })).status).toBe(403)
        await signInAs(demo("viewer"))
        const res = await call(listWarehouses, { method: "GET", headers: asMarsa() })
        expect(res.status).toBe(200)
        const rows = res.json?.warehouses as { id: string; isDefault: boolean }[]
        expect(rows.filter((w) => w.isDefault)).toHaveLength(1)
    })

    test("a viewer cannot add one; an owner can, and it is never the default", async () => {
        await signInAs(demo("viewer"))
        expect((await call(createWarehouse, { headers: asMarsa(), body: place() })).status).toBe(403)
        const id = await aWarehouse()
        const row = await prisma.warehouse.findUniqueOrThrow({ where: { id } })
        expect(row).toMatchObject({ shopId: marsa.id, isDefault: false, archivedAt: null })
        expect(row.latitude).not.toBeNull() // the governorate centre
        expect(await prisma.activityLog.count({ where: { entityType: "Warehouse", entityId: id, action: "CREATE" } })).toBe(1)
    })

    test("bad fields are a 400", async () => {
        await signInAs(OWNER)
        for (const body of [place({ name: "" }), place({ city: "" }), place({ governorate: "Atlantis" }), place({ latitude: 48.8, longitude: 2.3 })]) {
            expect((await call(createWarehouse, { headers: asMarsa(), body })).status).toBe(400)
        }
    })

    test("only one default: making another one moves the flag", async () => {
        const id = await aWarehouse()
        const res = await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(id), body: { makeDefault: true } })
        expect(res.status).toBe(200)
        const rows = await prisma.warehouse.findMany({ where: { shopId: marsa.id, isDefault: true, archivedAt: null } })
        expect(rows.map((w) => w.id)).toEqual([id])
        // give it back, so the other tests find the default where they expect it
        await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(main.id), body: { makeDefault: true } })
        expect((await prisma.warehouse.findUniqueOrThrow({ where: { id: main.id } })).isDefault).toBe(true)
    })

    test("the database itself refuses a second default", async () => {
        const id = await aWarehouse()
        await expect(prisma.warehouse.update({ where: { id }, data: { isDefault: true } })).rejects.toThrow()
    })

    test("a warehouse with no history can be deleted; the default cannot", async () => {
        const id = await aWarehouse()
        expect((await call(deleteWarehouse, { method: "DELETE", headers: asMarsa(), ...params(id) })).status).toBe(200)
        expect(await prisma.warehouse.count({ where: { id } })).toBe(0)
        const res = await call(deleteWarehouse, { method: "DELETE", headers: asMarsa(), ...params(main.id) })
        expect(res.status).toBe(409)
        expect(String(res.json?.error)).toMatch(/default/)
    })

    test("a warehouse with history is archived, not deleted, and only when empty", async () => {
        const id = await aWarehouse()
        const p = await aProduct(10)
        await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: id, quantity: 4 } })

        const del = await call(deleteWarehouse, { method: "DELETE", headers: asMarsa(), ...params(id) })
        expect(del.status).toBe(409)
        expect(String(del.json?.error)).toMatch(/Archive it instead/)

        const full = await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(id), body: { archived: true } })
        expect(full.status).toBe(409)
        expect(String(full.json?.error)).toMatch(/Move its 4 items/)

        await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: id, toId: main.id, quantity: 4 } })
        expect((await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(id), body: { archived: true } })).status).toBe(200)
        expect((await prisma.warehouse.findUniqueOrThrow({ where: { id } })).archivedAt).not.toBeNull()
        // an archived warehouse takes no stock
        const into = await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: id, quantity: 1 } })
        expect(into.status).toBe(409)
        // and can come back
        expect((await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(id), body: { archived: false } })).status).toBe(200)
    })

    test("a warehouse of another shop is a 404", async () => {
        const other = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { id: true } })
        const w = await prisma.warehouse.create({ data: { shopId: other.id, name: uniq(), city: "Tunis", isDefault: false } })
        await signInAs(OWNER)
        expect((await call(updateWarehouse, { method: "PATCH", headers: asMarsa(), ...params(w.id), body: { name: "Mine now" } })).status).toBe(404)
        expect((await call(deleteWarehouse, { method: "DELETE", headers: asMarsa(), ...params(w.id) })).status).toBe(404)
        await prisma.warehouse.delete({ where: { id: w.id } })
    })
})

describe("manual movements", () => {
    test("received, adjusted and counted change the level, the product total and the ledger", async () => {
        const p = await aProduct(10)
        expect(await total(p)).toBe(10)

        const rec = await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "RECEIVED", quantity: 5, reason: "Delivery" } })
        expect(rec.status).toBe(201)
        expect(await level(p, main.id)).toBe(15)

        expect((await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "ADJUSTED", quantity: -3, reason: "Broken" } })).status).toBe(201)
        expect(await level(p, main.id)).toBe(12)

        expect((await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "COUNTED", quantity: 20 } })).status).toBe(201)
        expect(await level(p, main.id)).toBe(20)
        expect(await total(p)).toBe(20)

        const rows = await prisma.stockMovement.findMany({ where: { productId: p }, orderBy: { createdAt: "asc" } })
        expect(rows.map((r) => [r.type, r.quantity, r.balanceAfter])).toEqual([
            ["RECEIVED", 10, 10], ["RECEIVED", 5, 15], ["ADJUSTED", -3, 12], ["COUNTED", 8, 20],
        ])
        expect(rows[1].reason).toBe("Delivery")
    })

    test("not enough stock is a 409 and nothing changes", async () => {
        const p = await aProduct(3)
        const res = await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "ADJUSTED", quantity: -4 } })
        expect(res.status).toBe(409)
        expect(String(res.json?.error)).toMatch(/Not enough stock/)
        expect(await level(p, main.id)).toBe(3)
        expect(await prisma.stockMovement.count({ where: { productId: p } })).toBe(1)
    })

    test("a count equal to the stock records nothing", async () => {
        const p = await aProduct(3)
        const res = await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "COUNTED", quantity: 3 } })
        expect(res.status).toBe(409)
        expect(await prisma.stockMovement.count({ where: { productId: p } })).toBe(1)
    })

    test("bad requests are a 400", async () => {
        const p = await aProduct(3)
        const base = { productId: p, warehouseId: main.id }
        for (const body of [
            { ...base, type: "SOLD", quantity: 1 },
            { ...base, type: "RECEIVED", quantity: 0 },
            { ...base, type: "ADJUSTED", quantity: 0 },
            { ...base, type: "COUNTED", quantity: -1 },
            { ...base, type: "RECEIVED", quantity: 1.5 },
            { ...base, type: "RECEIVED", quantity: 1, reason: "x".repeat(201) },
            { warehouseId: main.id, type: "RECEIVED", quantity: 1 },
            { productId: p, type: "RECEIVED", quantity: 1 },
        ]) {
            expect((await call(moveStock, { headers: asMarsa(), body })).status, JSON.stringify(body)).toBe(400)
        }
    })

    test("who may: a viewer cannot, and neither can a clerk of another shop", async () => {
        const p = await aProduct(3)
        const body = { productId: p, warehouseId: main.id, type: "RECEIVED", quantity: 1 }
        await signInAs(demo("viewer"))
        expect((await call(moveStock, { headers: asMarsa(), body })).status).toBe(403)
        await signInAs(demo("inventory")) // clerk of the Tunis shop only
        expect((await call(moveStock, { headers: asMarsa(), body })).status).toBe(403)
        expect(await level(p, main.id)).toBe(3)
    })

    test("an inventory clerk can move stock in their own shop", async () => {
        const tunis = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { id: true, publicShopId: true } })
        const wh = await prisma.$transaction((tx) => ensureDefaultWarehouse(tx, tunis.id))
        const product = await prisma.product.create({ data: { shopId: tunis.id, name: uniq(), price: "5.000", stock: 0, unit: "PIECE", status: "ACTIVE", images: [] } as never })
        await signInAs(demo("inventory"))
        const res = await call(moveStock, { headers: { [SHOP_HEADER]: tunis.publicShopId }, body: { productId: product.id, warehouseId: wh.id, type: "RECEIVED", quantity: 2 } })
        expect(res.status).toBe(201)
        expect(await level(product.id, wh.id)).toBe(2)
    })

    test("a product or warehouse of another shop is a 404", async () => {
        const p = await aProduct(3)
        await signInAs(OWNER)
        expect((await call(moveStock, { headers: asMarsa(), body: { productId: "nope", warehouseId: main.id, type: "RECEIVED", quantity: 1 } })).status).toBe(404)
        expect((await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: "nope", type: "RECEIVED", quantity: 1 } })).status).toBe(404)
    })
})

describe("transfers", () => {
    test("move stock between two warehouses: two linked rows, the total does not change", async () => {
        const to = await aWarehouse()
        const p = await aProduct(10)
        const res = await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 4, reason: "Closer to clients" } })
        expect(res.status).toBe(201)
        expect(await level(p, main.id)).toBe(6)
        expect(await level(p, to)).toBe(4)
        expect(await total(p)).toBe(10)

        const transferId = (res.json?.transfer as { transferId: string }).transferId
        const rows = await prisma.stockMovement.findMany({ where: { transferId }, orderBy: { quantity: "asc" } })
        expect(rows.map((r) => [r.type, r.warehouseId, r.quantity, r.balanceAfter])).toEqual([
            ["TRANSFER_OUT", main.id, -4, 6], ["TRANSFER_IN", to, 4, 4],
        ])
    })

    test("more than the warehouse holds is a 409 and nothing moves", async () => {
        const to = await aWarehouse()
        const p = await aProduct(2)
        const res = await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 3 } })
        expect(res.status).toBe(409)
        expect(await level(p, main.id)).toBe(2)
        expect(await level(p, to)).toBe(0)
        expect(await prisma.stockMovement.count({ where: { productId: p } })).toBe(1)
    })

    test("same warehouse, zero, or a viewer: refused", async () => {
        const to = await aWarehouse()
        const p = await aProduct(5)
        expect((await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: main.id, quantity: 1 } })).status).toBe(409)
        expect((await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 0 } })).status).toBe(400)
        await signInAs(demo("viewer"))
        expect((await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 1 } })).status).toBe(403)
    })

    test("two transfers at once cannot take more than is there", async () => {
        const to = await aWarehouse()
        const p = await aProduct(5)
        await signInAs(OWNER)
        const results = await Promise.all([1, 2].map(() => call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 4 } })))
        expect(results.map((r) => r.status).sort()).toEqual([201, 409])
        expect(await level(p, main.id)).toBe(1)
        expect(await level(p, to)).toBe(4)
        expect(await total(p)).toBe(5)
    })
})

describe("the ledger", () => {
    test("is append-only: rows cannot be edited or deleted", async () => {
        const p = await aProduct(5)
        const row = await prisma.stockMovement.findFirstOrThrow({ where: { productId: p } })
        await expect(prisma.stockMovement.update({ where: { id: row.id }, data: { quantity: 99 } })).rejects.toThrow(/append-only/)
        await expect(prisma.stockMovement.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/)
    })

    test("the database refuses negative stock and an empty movement", async () => {
        const p = await aProduct(5)
        await expect(prisma.stockLevel.update({ where: { productId_warehouseId: { productId: p, warehouseId: main.id } }, data: { quantity: -1 } })).rejects.toThrow()
        await expect(prisma.stockMovement.create({ data: { shopId: marsa.id, warehouseId: main.id, productId: p, type: "ADJUSTED", quantity: 0, balanceAfter: 5 } })).rejects.toThrow()
    })

    test("the history lists newest first, with filters and paging", async () => {
        const to = await aWarehouse()
        const p = await aProduct(10)
        await call(transfer, { headers: asMarsa(), body: { productId: p, fromId: main.id, toId: to, quantity: 3 } })
        await call(moveStock, { headers: asMarsa(), body: { productId: p, warehouseId: main.id, type: "RECEIVED", quantity: 2 } })

        const all = await call(listMovements, { method: "GET", headers: asMarsa(), url: `http://localhost/api/shop/stock/movements?product=${p}` })
        expect(all.status).toBe(200)
        const rows = all.json?.items as { type: string; product: { name: string }; warehouse: { name: string }; by: { name: string } | null }[]
        // the two rows of a transfer are written together, so their order between themselves is not fixed
        expect(rows.map((r) => r.type)[0]).toBe("RECEIVED")
        expect(rows.map((r) => r.type).slice(1, 3).sort()).toEqual(["TRANSFER_IN", "TRANSFER_OUT"])
        expect(rows.map((r) => r.type)[3]).toBe("RECEIVED")
        expect(rows[0].product.name).toBeTruthy()
        expect(rows[0].warehouse.name).toBeTruthy()
        expect(rows[0].by?.name).toBeTruthy()
        expect(all.json).toMatchObject({ total: 4, page: 1 })

        const typed = await call(listMovements, { method: "GET", headers: asMarsa(), url: `http://localhost/api/shop/stock/movements?product=${p}&type=TRANSFER_IN` })
        expect((typed.json?.items as unknown[]).length).toBe(1)
        const inWarehouse = await call(listMovements, { method: "GET", headers: asMarsa(), url: `http://localhost/api/shop/stock/movements?product=${p}&warehouse=${to}` })
        expect((inWarehouse.json?.items as unknown[]).length).toBe(1)
        const paged = await call(listMovements, { method: "GET", headers: asMarsa(), url: `http://localhost/api/shop/stock/movements?product=${p}&pageSize=2&page=2` })
        expect((paged.json?.items as unknown[]).length).toBe(2)
        expect(paged.json).toMatchObject({ total: 4, page: 2, pageCount: 2 })
    })

    test("a person from another shop cannot read it", async () => {
        await signInAs(demo("manager-tunis"))
        expect((await call(listMovements, { method: "GET", headers: asMarsa() })).status).toBe(403)
    })
})

describe("products and the ledger", () => {
    test("a new product's stock is an opening RECEIVED row in the default warehouse", async () => {
        const p = await aProduct(7)
        expect(await level(p, main.id)).toBe(7)
        const rows = await prisma.stockMovement.findMany({ where: { productId: p } })
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ type: "RECEIVED", quantity: 7, balanceAfter: 7, reason: "Opening stock" })
        // no stock, no row
        await signInAs(OWNER)
        const res = await call(createProduct, { headers: asMarsa(), body: { name: uniq(), price: 5, stock: 0 } })
        const id = (res.json?.product as { id: string }).id
        expect(await prisma.stockMovement.count({ where: { productId: id } })).toBe(0)
    })

    test("editing the stock of a product (one warehouse) is a COUNTED row", async () => {
        const p = await aProduct(7)
        const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { stock: 12 } })
        expect(res.status).toBe(200)
        expect(await level(p, main.id)).toBe(12)
        expect(await total(p)).toBe(12)
        const last = await prisma.stockMovement.findFirstOrThrow({ where: { productId: p }, orderBy: { createdAt: "desc" } })
        expect(last).toMatchObject({ type: "COUNTED", quantity: 5, balanceAfter: 12 })
    })

    test("with several warehouses the product form cannot set the stock: 409, nothing changes", async () => {
        await aWarehouse()
        const p = await aProduct(7)
        const res = await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { stock: 12 } })
        expect(res.status).toBe(409)
        expect(String(res.json?.error)).toMatch(/Inventory page/)
        expect(await total(p)).toBe(7)
        // other fields of the same product still save
        expect((await call(updateProduct, { method: "PATCH", headers: asMarsa(), ...params(p), body: { price: 9 } })).status).toBe(200)
    })
})

describe("reorder point and the stock view", () => {
    const view = (over: Record<string, string> = {}) => listInventory(marsa.id, parseInventoryQuery({ pageSize: "100", ...over }))
    const ids = (r: Awaited<ReturnType<typeof view>>) => r.items.map((i) => i.id)

    test("a reorder point is saved per warehouse, cleared with null, and refused when negative", async () => {
        const p = await aProduct(10)
        const body = (reorderPoint: unknown) => ({ productId: p, warehouseId: main.id, reorderPoint })
        expect((await call(setReorder, { method: "PATCH", headers: asMarsa(), body: body(4) })).status).toBe(200)
        expect((await prisma.stockLevel.findUniqueOrThrow({ where: { productId_warehouseId: { productId: p, warehouseId: main.id } } })).reorderPoint).toBe(4)
        expect((await call(setReorder, { method: "PATCH", headers: asMarsa(), body: body(null) })).status).toBe(200)
        expect((await prisma.stockLevel.findUniqueOrThrow({ where: { productId_warehouseId: { productId: p, warehouseId: main.id } } })).reorderPoint).toBeNull()
        expect((await call(setReorder, { method: "PATCH", headers: asMarsa(), body: body(-1) })).status).toBe(400)
        expect((await call(setReorder, { method: "PATCH", headers: asMarsa(), body: { productId: p, warehouseId: "nope", reorderPoint: 1 } })).status).toBe(404)
        await signInAs(demo("viewer"))
        expect((await call(setReorder, { method: "PATCH", headers: asMarsa(), body: body(2) })).status).toBe(403)
    })

    test("low means at or below the reorder point, and not out; out means none left", async () => {
        const to = await aWarehouse()
        const low = await aProduct(3)
        const fine = await aProduct(30)
        const none = await aProduct(0)
        const unset = await aProduct(1) // never low: no reorder point
        await signInAs(OWNER)
        for (const [p, point] of [[low, 5], [fine, 5], [none, 5]] as const) {
            await call(setReorder, { method: "PATCH", headers: asMarsa(), body: { productId: p, warehouseId: main.id, reorderPoint: point } })
        }
        const lowIds = ids(await view({ stock: "low" }))
        expect(lowIds).toContain(low)
        expect(lowIds).not.toContain(fine)
        expect(lowIds).not.toContain(none)
        expect(lowIds).not.toContain(unset)

        const outIds = ids(await view({ stock: "out" }))
        expect(outIds).toContain(none)
        expect(outIds).not.toContain(low)

        // in a chosen warehouse the judgement is that warehouse's own
        await call(transfer, { headers: asMarsa(), body: { productId: fine, fromId: main.id, toId: to, quantity: 30 } })
        expect(ids(await view({ stock: "out", warehouse: main.id }))).toContain(fine)
        expect(ids(await view({ stock: "out", warehouse: to }))).not.toContain(fine)
        expect(ids(await view({ warehouse: to }))).toEqual([fine]) // only products that have a level there
    })

    test("search and the counts", async () => {
        const p = await aProduct(0)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: p } })
        expect(ids(await view({ q: row.name }))).toEqual([p])
        const counts = await inventoryCounts(marsa.id)
        expect(counts.products).toBeGreaterThan(0)
        expect(counts.out).toBeGreaterThan(0)
    })
})
