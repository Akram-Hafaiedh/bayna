// lib/product-input.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { parseMinOrderQty, parsePrice, parseStock, parseText, parseUnit } from "@/lib/products/product-input"

test("parsePrice returns a 3-decimal string", () => {
    assert.deepEqual(parsePrice(12.5), { ok: true, value: "12.500" })
    assert.deepEqual(parsePrice("0.001"), { ok: true, value: "0.001" })
    assert.deepEqual(parsePrice("1234"), { ok: true, value: "1234.000" })
})

test("parsePrice refuses zero, negatives and anything below a millime", () => {
    for (const bad of [0, "0", -1, "-0.5", "0.0004", "0.000"]) {
        const r = parsePrice(bad)
        assert.equal(r.ok, false, String(bad))
        assert.equal(r.ok ? "" : r.error, "Price must be greater than 0", String(bad))
    }
})

test("parsePrice refuses non-numbers and absurd values", () => {
    for (const bad of ["", "abc", null, undefined, {}, [], Number.NaN, Infinity, 1_000_000_000]) {
        assert.equal(parsePrice(bad).ok, false, String(bad))
    }
})

test("parseStock is a whole non-negative number, empty means 0", () => {
    assert.deepEqual(parseStock(""), { ok: true, value: 0 })
    assert.deepEqual(parseStock(undefined), { ok: true, value: 0 })
    assert.deepEqual(parseStock("12"), { ok: true, value: 12 })
    for (const bad of [-1, 1.5, "x", 3_000_000_000, {}]) assert.equal(parseStock(bad).ok, false, String(bad))
})

test("parseMinOrderQty: empty is none, otherwise 1 or more", () => {
    assert.deepEqual(parseMinOrderQty(""), { ok: true, value: null })
    assert.deepEqual(parseMinOrderQty(3), { ok: true, value: 3 })
    for (const bad of [0, -2, 2.5, "x"]) assert.equal(parseMinOrderQty(bad).ok, false, String(bad))
})

test("parseUnit accepts only known units", () => {
    assert.deepEqual(parseUnit("BAG"), { ok: true, value: "BAG" })
    assert.equal(parseUnit("bag").ok, false)
    assert.equal(parseUnit("BOX").ok, false)
    assert.equal(parseUnit(undefined).ok, false)
})

test("parseText trims, turns empty into null and enforces the length", () => {
    assert.deepEqual(parseText("  hi  ", "Name", 10), { ok: true, value: "hi" })
    assert.deepEqual(parseText("   ", "Name", 10), { ok: true, value: null })
    assert.deepEqual(parseText(undefined, "Name", 10), { ok: true, value: null })
    assert.equal(parseText("x".repeat(11), "Name", 10).ok, false)
    assert.equal(parseText(42, "Name", 10).ok, false)
})
