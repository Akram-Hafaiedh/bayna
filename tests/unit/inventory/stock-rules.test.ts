// tests/unit/inventory/stock-rules.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    checkArchive, checkDelete, checkMakeDefault, checkTransfer, isManualType, isMovementType, MAX_QUANTITY,
    MOVEMENT_LABEL, MOVEMENT_TYPES, parseCount, parseDelta, parseQuantity, parseReason, planMovement, stockAlert, stockState,
} from "@/lib/inventory/stock-rules"

const value = <T,>(r: { ok: true; value: T } | { ok: false; error: string }) => {
    if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
    return r.value
}
const error = (r: { ok: boolean; error?: string }) => {
    assert.equal(r.ok, false)
    return (r as { error: string }).error
}

test("every movement type has a label and is recognised", () => {
    for (const t of MOVEMENT_TYPES) {
        assert.ok(MOVEMENT_LABEL[t])
        assert.ok(isMovementType(t))
    }
    assert.equal(isMovementType("STOLEN"), false)
    assert.equal(isMovementType(3), false)
})

test("received, returned, adjusted and counted can be done by hand; sold and transfers cannot", () => {
    for (const t of ["RECEIVED", "RETURNED", "ADJUSTED", "COUNTED"]) assert.ok(isManualType(t), t)
    for (const t of ["SOLD", "TRANSFER_IN", "TRANSFER_OUT"]) assert.equal(isManualType(t), false)
})

test("parseQuantity: whole numbers from 1", () => {
    assert.equal(value(parseQuantity(5)), 5)
    assert.equal(value(parseQuantity("12")), 12)
    for (const bad of [0, -1, 1.5, "", "  ", "abc", null, undefined, MAX_QUANTITY + 1, NaN]) {
        assert.equal(parseQuantity(bad).ok, false, String(bad))
    }
    assert.equal(value(parseQuantity(MAX_QUANTITY)), MAX_QUANTITY)
})

test("parseCount: zero is allowed", () => {
    assert.equal(value(parseCount(0)), 0)
    assert.equal(value(parseCount("7")), 7)
    for (const bad of [-1, 2.5, "", null, MAX_QUANTITY + 1]) assert.equal(parseCount(bad).ok, false, String(bad))
})

test("parseDelta: plus or minus, never zero", () => {
    assert.equal(value(parseDelta(-4)), -4)
    assert.equal(value(parseDelta("3")), 3)
    for (const bad of [0, "0", 1.2, "", null, MAX_QUANTITY + 1, -MAX_QUANTITY - 1]) assert.equal(parseDelta(bad).ok, false, String(bad))
})

test("parseReason: trimmed, optional, at most 200 characters", () => {
    assert.equal(value(parseReason(undefined)), null)
    assert.equal(value(parseReason(null)), null)
    assert.equal(value(parseReason("   ")), null)
    assert.equal(value(parseReason("  damaged  ")), "damaged")
    assert.equal(parseReason(5).ok, false)
    assert.equal(parseReason("x".repeat(201)).ok, false)
    assert.equal(parseReason("x".repeat(200)).ok, true)
})

test("planMovement: additions", () => {
    for (const t of ["RECEIVED", "RETURNED", "TRANSFER_IN"] as const) {
        assert.deepEqual(value(planMovement(t, 10, 4)), { delta: 4, after: 14 })
        assert.equal(planMovement(t, 10, 0).ok, false)
        assert.equal(planMovement(t, 10, -2).ok, false)
    }
})

test("planMovement: removals cannot go below zero", () => {
    for (const t of ["SOLD", "TRANSFER_OUT"] as const) {
        assert.deepEqual(value(planMovement(t, 10, 10)), { delta: -10, after: 0 })
        assert.deepEqual(value(planMovement(t, 10, 3)), { delta: -3, after: 7 })
        assert.match(error(planMovement(t, 10, 11)), /Not enough stock.*holds 10/)
        assert.equal(planMovement(t, 10, 0).ok, false)
    }
})

test("planMovement: adjustment takes a signed change", () => {
    assert.deepEqual(value(planMovement("ADJUSTED", 10, -3)), { delta: -3, after: 7 })
    assert.deepEqual(value(planMovement("ADJUSTED", 10, 5)), { delta: 5, after: 15 })
    assert.equal(planMovement("ADJUSTED", 10, 0).ok, false)
    assert.match(error(planMovement("ADJUSTED", 2, -3)), /Not enough stock/)
})

test("planMovement: a count sets the quantity and records the difference", () => {
    assert.deepEqual(value(planMovement("COUNTED", 10, 7)), { delta: -3, after: 7 })
    assert.deepEqual(value(planMovement("COUNTED", 10, 25)), { delta: 15, after: 25 })
    assert.deepEqual(value(planMovement("COUNTED", 10, 0)), { delta: -10, after: 0 })
    assert.match(error(planMovement("COUNTED", 10, 10)), /nothing changed/)
    assert.equal(planMovement("COUNTED", 10, -1).ok, false)
})

test("planMovement: refuses a quantity that is too large", () => {
    assert.match(error(planMovement("RECEIVED", MAX_QUANTITY, 1)), /too large/)
})

test("checkTransfer", () => {
    const base = { fromId: "a", toId: "b", fromShopId: "s", toShopId: "s", fromArchived: false, toArchived: false }
    assert.equal(checkTransfer(base).ok, true)
    assert.match(error(checkTransfer({ ...base, toId: "a" })), /two different/)
    assert.match(error(checkTransfer({ ...base, toShopId: "other" })), /not found/)
    assert.match(error(checkTransfer({ ...base, toArchived: true })), /no new stock/)
    assert.match(error(checkTransfer({ ...base, fromArchived: true })), /no stock to move/)
})

test("stockState: out, low, ok", () => {
    assert.equal(stockState(0, 5), "out")
    assert.equal(stockState(0, null), "out")
    assert.equal(stockState(5, 5), "low")
    assert.equal(stockState(3, 5), "low")
    assert.equal(stockState(6, 5), "ok")
    assert.equal(stockState(1, null), "ok")
})

test("checkDelete: not the default, and no history", () => {
    assert.equal(checkDelete({ isDefault: false, movementCount: 0 }).ok, true)
    assert.match(error(checkDelete({ isDefault: true, movementCount: 0 })), /default/)
    assert.match(error(checkDelete({ isDefault: false, movementCount: 2 })), /Archive it instead/)
})

test("checkArchive: live, not the default, empty", () => {
    assert.equal(checkArchive({ isDefault: false, archived: false, stockTotal: 0 }).ok, true)
    assert.match(error(checkArchive({ isDefault: false, archived: true, stockTotal: 0 })), /already archived/)
    assert.match(error(checkArchive({ isDefault: true, archived: false, stockTotal: 0 })), /default/)
    assert.match(error(checkArchive({ isDefault: false, archived: false, stockTotal: 1 })), /1 item of stock/)
    assert.match(error(checkArchive({ isDefault: false, archived: false, stockTotal: 4 })), /4 items of stock/)
})

test("checkMakeDefault", () => {
    assert.equal(checkMakeDefault({ archived: false, isDefault: false }).ok, true)
    assert.match(error(checkMakeDefault({ archived: true, isDefault: false })), /Restore/)
    assert.match(error(checkMakeDefault({ archived: false, isDefault: true })), /already the default/)
})

test("stockAlert: only the crossing counts", () => {
    const base = { type: "ADJUSTED" as const, productBefore: 10, productAfter: 10, levelBefore: 10, levelAfter: 10, reorderPoint: 5 as number | null }
    // above the point: nothing
    assert.equal(stockAlert(base), null)
    // crossing down to the point, or below it, but not empty: low
    assert.equal(stockAlert({ ...base, levelAfter: 5, productAfter: 5 }), "low")
    assert.equal(stockAlert({ ...base, levelAfter: 2, productAfter: 2 }), "low")
    // already low and getting lower: no second alert
    assert.equal(stockAlert({ ...base, levelBefore: 4, levelAfter: 2, productBefore: 4, productAfter: 2 }), null)
    // restocked above the point and then dropping again: alerts again
    assert.equal(stockAlert({ ...base, levelBefore: 6, levelAfter: 5, productBefore: 6, productAfter: 5 }), "low")
    // no reorder point: never low
    assert.equal(stockAlert({ ...base, reorderPoint: null, levelAfter: 1, productAfter: 1 }), null)
})

test("stockAlert: out is about the whole product, and wins over low", () => {
    const base = { type: "ADJUSTED" as const, productBefore: 3, productAfter: 0, levelBefore: 3, levelAfter: 0, reorderPoint: 5 as number | null }
    assert.equal(stockAlert(base), "out")
    assert.equal(stockAlert({ ...base, reorderPoint: null }), "out")
    // one warehouse emptied while another still holds stock: not out
    assert.equal(stockAlert({ ...base, productAfter: 4, productBefore: 7, reorderPoint: null }), null)
    // it was already at 0: nothing new
    assert.equal(stockAlert({ ...base, productBefore: 0, levelBefore: 0 }), null)
})

test("stockAlert: transfers never notify", () => {
    const move = { productBefore: 10, productAfter: 10, levelBefore: 10, levelAfter: 0, reorderPoint: 5 as number | null }
    assert.equal(stockAlert({ ...move, type: "TRANSFER_OUT" }), null)
    assert.equal(stockAlert({ ...move, type: "TRANSFER_IN" }), null)
})
