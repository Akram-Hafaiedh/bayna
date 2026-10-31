// tests/unit/inventory/movement-query.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { MOVEMENT_MAX_PAGE_SIZE, MOVEMENT_PAGE_SIZE, parseMovementQuery } from "@/lib/inventory/movement-query"

const q = (s: string) => parseMovementQuery(new URLSearchParams(s))

test("no filters: defaults", () => {
    assert.deepEqual(q(""), { warehouseId: null, productId: null, type: null, reasonCode: null, from: null, to: null, page: 1, pageSize: MOVEMENT_PAGE_SIZE })
})

test("warehouse, product and type filters", () => {
    const r = q("warehouse=w1&product=p1&type=SOLD")
    assert.equal(r.warehouseId, "w1")
    assert.equal(r.productId, "p1")
    assert.equal(r.type, "SOLD")
    assert.equal(q("type=NOPE").type, null)
})

test("the reason filter takes only known reasons", () => {
    assert.equal(q("reasonCode=DAMAGED").reasonCode, "DAMAGED")
    assert.equal(q("reasonCode=NOPE").reasonCode, null)
    assert.equal(q("reasonCode=toString").reasonCode, null)
})

test("the date range is inclusive: `to` is the start of the next day", () => {
    const r = q("from=2026-10-01&to=2026-10-31")
    assert.equal(r.from?.toISOString(), "2026-10-01T00:00:00.000Z")
    assert.equal(r.to?.toISOString(), "2026-11-01T00:00:00.000Z")
})

test("bad dates are ignored", () => {
    for (const bad of ["2026-13-01", "01/10/2026", "yesterday", "2026-10-1"]) {
        const r = q(`from=${bad}&to=${bad}`)
        assert.equal(r.from, null, bad)
        assert.equal(r.to, null, bad)
    }
})

test("paging: positive whole numbers, page size capped", () => {
    assert.equal(q("page=3").page, 3)
    for (const bad of ["0", "-2", "1.5", "x"]) assert.equal(q(`page=${bad}`).page, 1, bad)
    assert.equal(q("pageSize=20").pageSize, 20)
    assert.equal(q("pageSize=99999").pageSize, MOVEMENT_MAX_PAGE_SIZE)
    for (const bad of ["0", "-5", "2.5", "x"]) assert.equal(q(`pageSize=${bad}`).pageSize, MOVEMENT_PAGE_SIZE, bad)
})
