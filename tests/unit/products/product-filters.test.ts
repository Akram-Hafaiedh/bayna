// tests/unit/products/product-filters.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { countAffected, describeCounts, priceEffect, unitChangeReason } from "@/lib/products/price-review"

test("the reason names both units", () => {
    assert.equal(unitChangeReason("PIECE", "BAG"), "Unit changed from Piece to Bag")
    assert.equal(unitChangeReason("SQUARE_METER", "ROLL"), "Unit changed from Square meter (m²) to Roll")
})

test("countAffected counts distinct products and shops", () => {
    const rows = [
        { id: "p1", shopId: "s1" },
        { id: "p2", shopId: "s1" },
        { id: "p3", shopId: "s2" },
        { id: "p3", shopId: "s2" },
    ]
    assert.deepEqual(countAffected(rows), { products: 3, shops: 2 })
    assert.deepEqual(countAffected([]), { products: 0, shops: 0 })
})

test("describeCounts uses the right plural", () => {
    assert.equal(describeCounts({ products: 1, shops: 1 }), "1 product in 1 shop")
    assert.equal(describeCounts({ products: 14, shops: 9 }), "14 products in 9 shops")
    assert.equal(describeCounts({ products: 2, shops: 1 }), "2 products in 1 shop")
})

test("a different price confirms the price", () => {
    assert.deepEqual(priceEffect({ currentPrice: 10, nextPrice: 12, confirm: false }), { stampDate: true, clearReview: true })
})

test("keeping the price needs an explicit confirmation", () => {
    assert.deepEqual(priceEffect({ currentPrice: 10, nextPrice: undefined, confirm: true }), { stampDate: true, clearReview: true })
})

test("sending the same price again confirms nothing", () => {
    assert.deepEqual(priceEffect({ currentPrice: 10, nextPrice: 10, confirm: false }), { stampDate: false, clearReview: false })
    assert.deepEqual(priceEffect({ currentPrice: 10, nextPrice: undefined, confirm: false }), { stampDate: false, clearReview: false })
})
