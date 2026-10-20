// lib/active-link.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isActiveLink } from "./active-link"

test("a link is active on its own page and below it, not on lookalikes", () => {
    assert.equal(isActiveLink("/provider/team", "/provider/team"), true)
    assert.equal(isActiveLink("/provider/products/abc/edit", "/provider/products"), true)
    assert.equal(isActiveLink("/provider/teamwork", "/provider/team"), false)
    assert.equal(isActiveLink("/business/team", "/provider/team"), false)
    assert.equal(isActiveLink(null, "/provider/team"), false)
})
