// tests/unit/pricing/price-history-rules.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isPriceReason, PRICE_REASONS, PRICE_REASON_LABEL, priceChange } from "@/lib/pricing/price-history-rules"

test("every reason is known and has a label", () => {
    for (const r of PRICE_REASONS) {
        assert.equal(isPriceReason(r), true)
        assert.ok(PRICE_REASON_LABEL[r].length > 0)
    }
    assert.equal(isPriceReason("SOMETHING"), false)
    assert.equal(isPriceReason(null), false)
})

test("how a price moved: up, down, same or first", () => {
    assert.deepEqual(priceChange(null, "12.500"), { direction: "first", amount: "0.000" })
    assert.deepEqual(priceChange("10.000", "12.500"), { direction: "up", amount: "2.500" })
    assert.deepEqual(priceChange("12.500", "10.000"), { direction: "down", amount: "2.500" })
    assert.deepEqual(priceChange("10.000", "10.000"), { direction: "same", amount: "0.000" })
    assert.deepEqual(priceChange("10", "10.001"), { direction: "up", amount: "0.001" })
})

test("the difference is exact to the millime, with no floating point drift", () => {
    assert.equal(priceChange("0.100", "0.300").amount, "0.200")
    assert.equal(priceChange("1234567.891", "1234567.890").amount, "0.001")
})

test("a value that is not an amount is refused", () => {
    assert.throws(() => priceChange("abc", "1"))
    assert.throws(() => priceChange("1", "x"))
})
