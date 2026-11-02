// tests/unit/products/product-clone.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { cloneName } from "@/lib/products/product-clone"

test("a copy is named after the product, with (copy)", () => {
    assert.equal(cloneName("Cement 50 kg"), "Cement 50 kg (copy)")
    assert.equal(cloneName("  Cement  "), "Cement (copy)")
})

test("a copy of a copy says so again, so two copies are told apart by the person renaming them", () => {
    assert.equal(cloneName("Cement (copy)"), "Cement (copy) (copy)")
})

test("a long name is cut so the copy still fits the 200 characters of a name", () => {
    const long = "x".repeat(200)
    const copy = cloneName(long)
    assert.equal(copy.length, 200)
    assert.ok(copy.endsWith(" (copy)"))
    assert.equal(cloneName("y".repeat(193)).length, 200)
    assert.equal(cloneName("y".repeat(194)).length, 200)
})
