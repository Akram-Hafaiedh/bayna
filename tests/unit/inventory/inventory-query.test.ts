// tests/unit/inventory/inventory-query.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { buildInventoryHref, hasInventoryFilters, INVENTORY_DEFAULT_PAGE_SIZE, parseInventoryQuery } from "@/lib/inventory/inventory-query"

const base = "/shop/abc/inventory"

test("no filters: defaults", () => {
    assert.deepEqual(parseInventoryQuery({}), { q: "", warehouseId: null, stock: "all", page: 1, pageSize: INVENTORY_DEFAULT_PAGE_SIZE })
    assert.equal(hasInventoryFilters(parseInventoryQuery({})), false)
})

test("reads the filters; unknown values fall back", () => {
    const q = parseInventoryQuery({ q: "  cement ", warehouse: "w1", stock: "low", page: "3", pageSize: "50" })
    assert.deepEqual(q, { q: "cement", warehouseId: "w1", stock: "low", page: 3, pageSize: 50 })
    assert.equal(hasInventoryFilters(q), true)
    const bad = parseInventoryQuery({ stock: "weird", page: "-1", pageSize: "7" })
    assert.deepEqual(bad, { q: "", warehouseId: null, stock: "all", page: 1, pageSize: INVENTORY_DEFAULT_PAGE_SIZE })
    assert.equal(parseInventoryQuery({ q: ["a", "b"] }).q, "a")
    assert.equal(parseInventoryQuery({ q: "x".repeat(300) }).q.length, 100)
})

test("the plain view has a plain address", () => {
    assert.equal(buildInventoryHref(base, parseInventoryQuery({})), base)
})

test("changing a filter goes back to page 1; changing the page keeps the filters", () => {
    const q = parseInventoryQuery({ q: "cement", page: "4" })
    assert.equal(buildInventoryHref(base, q, { stock: "out" }), `${base}?q=cement&stock=out`)
    assert.equal(buildInventoryHref(base, q, { page: 5 }), `${base}?q=cement&page=5`)
    assert.equal(buildInventoryHref(base, q, { q: "", page: 1 }), base)
    assert.equal(buildInventoryHref(base, q, { warehouseId: "w 2" }), `${base}?q=cement&warehouse=w+2`)
    assert.equal(buildInventoryHref(base, q, { pageSize: 100 }), `${base}?q=cement&pageSize=100`)
})
