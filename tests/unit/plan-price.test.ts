// lib/plan-price.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { parsePriceArgs, priceWarnings } from "@/lib/plan-price"

test("a plan key and at least one price are required", () => {
    assert.equal(parsePriceArgs([]).ok, false)
    assert.equal(parsePriceArgs(["PRO"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "BUSINESS", "--monthly", "5"]).ok, false)
})

test("both prices are read, the key is upper-cased", () => {
    const r = parsePriceArgs(["pro", "--monthly", "45", "--yearly", "450.5"])
    assert.deepEqual(r.ok && r.value, { planKey: "PRO", monthly: 45, yearly: 450.5, warnings: [] })
})

test("one price can change while the other stays, and none removes a price", () => {
    const one = parsePriceArgs(["PRO", "--yearly", "420"])
    assert.deepEqual(one.ok && [one.value.monthly, one.value.yearly], [undefined, 420])
    const none = parsePriceArgs(["PRO", "--monthly", "none"])
    assert.deepEqual(none.ok && [none.value.monthly, none.value.yearly], [null, undefined])
})

test("bad amounts and options are refused", () => {
    assert.equal(parsePriceArgs(["PRO", "--monthly", "-5"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "--monthly", "4,5"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "--monthly", "1.2345"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "--monthly", "999999"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "--monthly"]).ok, false)
    assert.equal(parsePriceArgs(["PRO", "--weekly", "3"]).ok, false)
})

test("the free plan cannot be given a price", () => {
    assert.equal(parsePriceArgs(["free", "--monthly", "5"]).ok, false)
})

test("warnings: no saving, or only one price", () => {
    assert.deepEqual(priceWarnings(40, 400), [])
    assert.equal(priceWarnings(40, 480).length, 1)
    assert.equal(priceWarnings(40, null).length, 1)
    assert.deepEqual(priceWarnings(null, null), [])
})
