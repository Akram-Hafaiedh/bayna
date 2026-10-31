// tests/unit/inventory/stock-reasons.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isReasonCode, parseReasonChoice, REASON_CODES, REASON_LABEL, reasonOptions } from "@/lib/inventory/stock-reasons"
import { MANUAL_TYPES } from "@/lib/inventory/stock-rules"

const error = (r: { ok: boolean; error?: string }) => {
    assert.equal(r.ok, false)
    return (r as { error: string }).error
}

test("every reason has a label, and every offered reason is a known code", () => {
    for (const c of REASON_CODES) assert.ok(REASON_LABEL[c])
    for (const t of MANUAL_TYPES) for (const sign of [1, -1]) for (const c of reasonOptions(t, sign)) assert.ok(isReasonCode(c), c)
    assert.equal(isReasonCode("NOPE"), false)
    assert.equal(isReasonCode("toString"), false)
    assert.equal(isReasonCode(null), false)
})

test("each kind offers its own list, and Other is always last", () => {
    assert.deepEqual(reasonOptions("RECEIVED"), ["SUPPLIER_DELIVERY", "PRODUCTION", "OTHER"])
    assert.deepEqual(reasonOptions("RETURNED"), ["CUSTOMER_RETURN", "OTHER"])
    assert.deepEqual(reasonOptions("COUNTED"), ["STOCKTAKE", "OTHER"])
    for (const t of MANUAL_TYPES) for (const sign of [1, -1]) {
        const list = reasonOptions(t, sign)
        assert.equal(list[list.length - 1], "OTHER", `${t} ${sign}`)
    }
})

test("an adjustment offers different reasons going up and going down; none before a change is typed", () => {
    assert.deepEqual(reasonOptions("ADJUSTED", 3), ["FOUND", "CORRECTION", "OTHER"])
    assert.deepEqual(reasonOptions("ADJUSTED", -3), ["DAMAGED", "LOST", "EXPIRED", "SAMPLE", "INTERNAL_USE", "CORRECTION", "OTHER"])
    assert.deepEqual(reasonOptions("ADJUSTED", 0), [])
    assert.deepEqual(reasonOptions("ADJUSTED", null), [])
    assert.deepEqual(reasonOptions("ADJUSTED"), [])
})

test("system reasons are never offered to a person", () => {
    for (const t of MANUAL_TYPES) for (const sign of [1, -1]) {
        assert.equal(reasonOptions(t, sign).includes("OPENING_STOCK"), false)
        assert.equal(reasonOptions(t, sign).includes("PRODUCT_EDIT"), false)
    }
    assert.match(error(parseReasonChoice("RECEIVED", 5, "OPENING_STOCK", null)), /does not fit/)
})

test("a reason is required and must fit the change", () => {
    assert.match(error(parseReasonChoice("RECEIVED", 5, undefined, null)), /Choose a reason/)
    assert.match(error(parseReasonChoice("RECEIVED", 5, "", null)), /Choose a reason/)
    assert.match(error(parseReasonChoice("RECEIVED", 5, "DAMAGED", null)), /does not fit/)
    // a down-reason cannot be used for an increase, nor the reverse
    assert.match(error(parseReasonChoice("ADJUSTED", 2, "DAMAGED", null)), /does not fit/)
    assert.match(error(parseReasonChoice("ADJUSTED", -2, "FOUND", null)), /does not fit/)
    assert.deepEqual(parseReasonChoice("ADJUSTED", -2, "DAMAGED", "dropped"), { ok: true, value: { reasonCode: "DAMAGED", reason: "dropped" } })
    assert.deepEqual(parseReasonChoice("ADJUSTED", 2, "FOUND", null), { ok: true, value: { reasonCode: "FOUND", reason: null } })
})

test("Other needs a note, the rest do not", () => {
    assert.match(error(parseReasonChoice("COUNTED", 4, "OTHER", null)), /note is needed/)
    assert.equal(parseReasonChoice("COUNTED", 4, "OTHER", "recount after the move").ok, true)
    assert.equal(parseReasonChoice("COUNTED", 4, "STOCKTAKE", null).ok, true)
})
