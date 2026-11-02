// tests/unit/products/tax-filter.test.ts
// The "Tax to set" filter of the product list: read from the address, written back, counted as a filter.
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { buildProductsHref, hasActiveFilters, parseProductFilters } from "@/lib/products/product-filters"

test("the tax filter is off unless the address says unset", () => {
    assert.equal(parseProductFilters(new URLSearchParams("")).tax, "all")
    assert.equal(parseProductFilters(new URLSearchParams("tax=unset")).tax, "unset")
    assert.equal(parseProductFilters(new URLSearchParams("tax=whatever")).tax, "all")
    assert.equal(parseProductFilters({ tax: "unset" }).tax, "unset")
})

test("the address keeps the tax filter, and leaves it out when off", () => {
    const f = parseProductFilters(new URLSearchParams("tax=unset"))
    assert.equal(buildProductsHref(f), "?tax=unset")
    assert.equal(buildProductsHref(f, { tax: "all" }), "?")
    assert.equal(buildProductsHref(f, { status: "draft" }), "?status=draft&tax=unset")
})

test("a tax filter counts as an active filter", () => {
    assert.equal(hasActiveFilters(parseProductFilters(new URLSearchParams("tax=unset"))), true)
    assert.equal(hasActiveFilters(parseProductFilters(new URLSearchParams(""))), false)
})
