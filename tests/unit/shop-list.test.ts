// lib/shop-list.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { countByStatus, filterShops, NO_SHOP_FILTERS, type ShopRow } from "@/lib/shops/shop-list"

const row = (over: Partial<ShopRow>): ShopRow => ({
    id: "1", publicShopId: "p1", name: "Shop", city: "Tunis", governorate: "Tunis", status: "ACTIVE",
    products: 0, team: 1, setupDone: 5, setupTotal: 5, openable: true, ...over,
})
const rows = [
    row({ id: "a", name: "Matériaux Ben Salah", city: "Sfax", governorate: "Sfax" }),
    row({ id: "b", name: "Tunis Béton", status: "PENDING" }),
    row({ id: "c", name: "Sousse Acier", city: "Sousse", governorate: null, status: "CLOSED" }),
]

test("no filters keeps everything", () => {
    assert.equal(filterShops(rows, NO_SHOP_FILTERS).length, 3)
})

test("search ignores case and accents, and looks at name and place", () => {
    assert.deepEqual(filterShops(rows, { q: "materiaux", status: "all" }).map((r) => r.id), ["a"])
    assert.deepEqual(filterShops(rows, { q: "SOUSSE", status: "all" }).map((r) => r.id), ["c"])
    assert.deepEqual(filterShops(rows, { q: "tunis", status: "all" }).map((r) => r.id), ["b"])
})

test("status filter and search combine", () => {
    assert.deepEqual(filterShops(rows, { q: "", status: "CLOSED" }).map((r) => r.id), ["c"])
    assert.deepEqual(filterShops(rows, { q: "tunis", status: "ACTIVE" }), [])
})

test("counts per status list only statuses that occur", () => {
    assert.deepEqual(countByStatus(rows), { ACTIVE: 1, PENDING: 1, CLOSED: 1 })
})
