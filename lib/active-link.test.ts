// lib/active-link.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isActiveLink } from "./active-link"

test("a link is active on its own page and below it, not on lookalikes", () => {
    assert.equal(isActiveLink("/shop/abc/team", "/shop/abc/team"), true)
    assert.equal(isActiveLink("/shop/abc/products/abc/edit", "/shop/abc/products"), true)
    assert.equal(isActiveLink("/shop/abc/teamwork", "/shop/abc/team"), false)
    assert.equal(isActiveLink("/business/team", "/shop/abc/team"), false)
    assert.equal(isActiveLink(null, "/shop/abc/team"), false)
})
