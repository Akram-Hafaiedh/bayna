// lib/product-status.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isListed, isProductStatus, platformMove, PRODUCT_STATUSES, shopMayChange, SHOP_CHOICES } from "@/lib/product-status"

test("only ACTIVE products are listed for customers", () => {
    assert.deepEqual(PRODUCT_STATUSES.filter(isListed), ["ACTIVE"])
})

test("a shop moves freely between draft, active and hidden", () => {
    for (const a of SHOP_CHOICES) for (const b of SHOP_CHOICES) assert.equal(shopMayChange(a, b), true)
})

test("a shop cannot block a product or lift a block", () => {
    assert.equal(shopMayChange("ACTIVE", "BLOCKED"), false)
    assert.equal(shopMayChange("BLOCKED", "ACTIVE"), false)
    assert.equal(shopMayChange("BLOCKED", "DRAFT"), false)
})

test("saving a blocked product with the same status is allowed", () => {
    assert.equal(shopMayChange("BLOCKED", "BLOCKED"), true)
})

test("the platform blocks anything not blocked, and unblocking returns a draft", () => {
    assert.equal(platformMove("block", "ACTIVE"), "BLOCKED")
    assert.equal(platformMove("block", "DRAFT"), "BLOCKED")
    assert.equal(platformMove("block", "BLOCKED"), null)
    assert.equal(platformMove("unblock", "BLOCKED"), "DRAFT")
    assert.equal(platformMove("unblock", "ACTIVE"), null)
})

test("isProductStatus accepts only known values", () => {
    assert.equal(isProductStatus("HIDDEN"), true)
    assert.equal(isProductStatus("hidden"), false)
    assert.equal(isProductStatus(undefined), false)
})
