// lib/access/active-business.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { pickActiveBusiness } from "@/lib/access/active-business"

test("nobody with no business gets none", () => {
    assert.equal(pickActiveBusiness([], "b1", "b2"), null)
})

test("a valid hint wins, then the business of the active shop, then the first by id", () => {
    assert.equal(pickActiveBusiness(["b1", "b2", "b3"], "b3", "b2"), "b3")
    assert.equal(pickActiveBusiness(["b1", "b2", "b3"], null, "b2"), "b2")
    assert.equal(pickActiveBusiness(["b3", "b1", "b2"], null, null), "b1")
})

test("a hint or shop business the person does not belong to is ignored", () => {
    assert.equal(pickActiveBusiness(["b1", "b2"], "evil", "alsoevil"), "b1")
    assert.equal(pickActiveBusiness(["b2"], "b1", "b1"), "b2")
})

test("duplicates do not matter", () => {
    assert.equal(pickActiveBusiness(["b2", "b2", "b1"], undefined, undefined), "b1")
})
