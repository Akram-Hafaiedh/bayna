// lib/parse.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { safeNextPath } from "./parse"

test("safeNextPath keeps paths inside the site", () => {
    assert.equal(safeNextPath("/invite/abc"), "/invite/abc")
    assert.equal(safeNextPath("/provider/team?x=1"), "/provider/team?x=1")
})

test("safeNextPath refuses anything that could leave the site", () => {
    for (const bad of ["", null, undefined, "https://evil.example", "//evil.example", "/\\evil.example", "evil.example", "javascript:alert(1)"]) {
        assert.equal(safeNextPath(bad as string | null | undefined), null, String(bad))
    }
})
