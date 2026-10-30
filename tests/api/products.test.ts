// tests/api/products.test.ts
// The product routes of a shop: list, create, edit, move to the trash and restore, with the roles that may and may not.
// The shop is the one named in the x-shop header, as the pages do.
// Run: npm run test:api
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { GET as listProducts, POST as createProduct } from "@/app/api/shop/products/route"
import { GET as getProduct, PATCH as updateProduct, DELETE as deleteProduct } from "@/app/api/shop/products/[id]/route"
import { POST as restoreProduct } from "@/app/api/shop/products/[id]/restore/route"
import { SHOP_NAMES } from "@/prisma/seed/seeders/users"
import { SHOP_HEADER } from "@/lib/shops/shop-paths"
import { call, cleanUp, demo, prisma, signInAs, signOut } from "./helpers"

const OWNER = "carthage@demo.bayna.test"
let tunis = { id: "", publicShopId: "" }
let marsa = { id: "" }

beforeAll(async () => {
    tunis = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.tunis }, select: { id: true, publicShopId: true } })
    marsa = await prisma.shop.findFirstOrThrow({ where: { name: SHOP_NAMES.marsa }, select: { id: true } })
})

afterEach(() => signOut())
afterAll(async () => {
    await prisma.product.deleteMany({ where: { name: { startsWith: "api-test-" } } })
    await cleanUp()
})

const asTunis = () => ({ [SHOP_HEADER]: tunis.publicShopId })
const name = () => `api-test-${randomUUID().slice(0, 8)}`
const fields = (over: Record<string, unknown> = {}) => ({ name: name(), price: 12.5, stock: 3, ...over })

/** A product made straight in the database. */
async function aProduct(shopId = tunis.id, data: Record<string, unknown> = {}) {
    return prisma.product.create({
        data: { shopId: shopId, name: name(), price: "10.000", stock: 5, unit: "PIECE", status: "ACTIVE", images: [], ...data } as never,
        select: { id: true, name: true },
    })
}
const params = (id: string) => ({ params: { id } })

describe("listing", () => {
    test("needs a signed-in person who works in that shop", async () => {
        signOut()
        expect((await call(listProducts, { method: "GET", headers: asTunis() })).status).toBe(401)
        await signInAs(demo("client"))
        expect((await call(listProducts, { method: "GET", headers: asTunis() })).status).toBe(403)
        // a manager of another shop does not work in this one
        await signInAs(demo("manager-marsa"))
        expect((await call(listProducts, { method: "GET", headers: asTunis() })).status).toBe(403)
    })

    test("a viewer sees the shop's products and nobody else's", async () => {
        const mine = await aProduct()
        const theirs = await aProduct(marsa.id)
        await signInAs(demo("viewer"))
        const res = await call(listProducts, { method: "GET", headers: asTunis() })
        expect(res.status).toBe(200)
        const ids = (res.json?.products as { id: string }[]).map((p) => p.id)
        expect(ids).toContain(mine.id)
        expect(ids).not.toContain(theirs.id)
    })
})

describe("creating", () => {
    test("a viewer cannot", async () => {
        await signInAs(demo("viewer"))
        const res = await call(createProduct, { headers: asTunis(), body: fields() })
        expect(res.status).toBe(403)
    })

    test("an owner creates a product in the shop named in the header", async () => {
        await signInAs(OWNER)
        const body = fields()
        const res = await call(createProduct, { headers: asTunis(), body })
        expect(res.status).toBe(201)
        const id = (res.json?.product as { id: string }).id
        const row = await prisma.product.findUniqueOrThrow({ where: { id } })
        expect(row).toMatchObject({ shopId: tunis.id, name: body.name, status: "ACTIVE", stock: 3 })
        expect(Number(row.price)).toBe(12.5)
        // the audit trigger logged the creation
        expect(await prisma.activityLog.count({ where: { entityType: "Product", entityId: id, action: "CREATE" } })).toBe(1)
    })

    test("an inventory clerk may list products but not set a price", async () => {
        await signInAs(demo("inventory"))
        const body = fields()
        const res = await call(createProduct, { headers: asTunis(), body })
        expect(res.status).toBe(403)
        expect(String(res.json?.error)).toMatch(/price/i)
        expect(await prisma.product.count({ where: { name: body.name } })).toBe(0)
    })

    test("a bad request is a 400", async () => {
        await signInAs(OWNER)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ name: "" }) })).status).toBe(400)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ price: 0 }) })).status).toBe(400)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ price: "abc" }) })).status).toBe(400)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ stock: -1 }) })).status).toBe(400)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ status: "BLOCKED" }) })).status).toBe(400)
        expect((await call(createProduct, { headers: asTunis(), body: fields({ categoryId: "no-such-category" }) })).status).toBe(400)
    })
})

describe("editing", () => {
    test("an owner changes the price: saved, and the price date is stamped", async () => {
        const p = await aProduct()
        await signInAs(OWNER)
        const res = await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(p.id), body: { price: 99.5 } })
        expect(res.status).toBe(200)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
        expect(Number(row.price)).toBe(99.5)
        expect(row.priceUpdatedAt).not.toBeNull()
    })

    test("an inventory clerk changes stock but not the price", async () => {
        const p = await aProduct()
        await signInAs(demo("inventory"))
        const price = await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(p.id), body: { price: 1 } })
        expect(price.status).toBe(403)
        const stock = await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(p.id), body: { stock: 42 } })
        expect(stock.status).toBe(200)
        const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
        expect(row.stock).toBe(42)
        expect(Number(row.price)).toBe(10)
    })

    test("a viewer cannot edit", async () => {
        const p = await aProduct()
        await signInAs(demo("viewer"))
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(p.id), body: { stock: 1 } })).status).toBe(403)
    })

    test("a product of another shop, or one that does not exist, is a 404", async () => {
        const other = await aProduct(marsa.id)
        await signInAs(OWNER)
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(other.id), body: { stock: 1 } })).status).toBe(404)
        expect((await call(getProduct, { method: "GET", headers: asTunis(), ...params(other.id) })).status).toBe(404)
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params("nope"), body: { stock: 1 } })).status).toBe(404)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: other.id } })).stock).toBe(5)
    })

    test("a shop cannot block, or unblock, its own product", async () => {
        const mine = await aProduct()
        const blocked = await aProduct(tunis.id, { status: "BLOCKED" })
        await signInAs(OWNER)
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(mine.id), body: { status: "BLOCKED" } })).status).toBe(403)
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(blocked.id), body: { status: "ACTIVE" } })).status).toBe(403)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: blocked.id } })).status).toBe("BLOCKED")
        // hiding it is the shop's own choice
        expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(mine.id), body: { status: "HIDDEN" } })).status).toBe(200)
    })

    test("a bad value is a 400", async () => {
        const p = await aProduct()
        await signInAs(OWNER)
        for (const body of [{ name: "" }, { price: -5 }, { stock: 1.5 }, { status: "NOPE" }, { categoryId: "no-such-category" }]) {
            expect((await call(updateProduct, { method: "PATCH", headers: asTunis(), ...params(p.id), body })).status).toBe(400)
        }
    })
})

describe("the trash", () => {
    test("deleting moves a product to the trash, and it can be restored", async () => {
        const p = await aProduct()
        await signInAs(OWNER)
        const del = await call(deleteProduct, { method: "DELETE", headers: asTunis(), ...params(p.id) })
        expect(del.status).toBe(200)
        const gone = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
        expect(gone.deletedAt).not.toBeNull()
        expect(gone.deletedById).not.toBeNull()
        // out of the list and out of reach
        expect((await call(getProduct, { method: "GET", headers: asTunis(), ...params(p.id) })).status).toBe(404)
        expect((await call(deleteProduct, { method: "DELETE", headers: asTunis(), ...params(p.id) })).status).toBe(404)

        const back = await call(restoreProduct, { headers: asTunis(), ...params(p.id) })
        expect(back.status).toBe(200)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeNull()
    })

    test("people without the permission cannot delete or restore", async () => {
        const p = await aProduct()
        await signInAs(demo("viewer"))
        expect((await call(deleteProduct, { method: "DELETE", headers: asTunis(), ...params(p.id) })).status).toBe(403)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeNull()

        const trashed = await aProduct(tunis.id, { deletedAt: new Date() })
        expect((await call(restoreProduct, { headers: asTunis(), ...params(trashed.id) })).status).toBe(403)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: trashed.id } })).deletedAt).not.toBeNull()
    })

    test("restoring something that is not in the trash is a 404", async () => {
        const p = await aProduct()
        await signInAs(OWNER)
        expect((await call(restoreProduct, { headers: asTunis(), ...params(p.id) })).status).toBe(404)
    })
})
