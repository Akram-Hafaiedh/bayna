// lib/user-detail.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { assignmentPlace, assignmentState, sessionState, userDetailPath } from "./user-detail"

test("the detail address uses the public id", () => {
    assert.equal(userDetailPath("abc123"), "/admin/users/abc123")
})

test("a session is open until it is revoked", () => {
    assert.equal(sessionState({ revokedAt: null }), "open")
    assert.equal(sessionState({ revokedAt: new Date() }), "ended")
})

test("a role names where it applies", () => {
    assert.equal(assignmentPlace({ scope: "PLATFORM", shop: null, business: null }), "Bayna platform")
    assert.equal(assignmentPlace({ scope: "BUSINESS", shop: null, business: { name: "Carthage Group" } }), "Carthage Group")
    assert.equal(assignmentPlace({ scope: "SHOP", shop: { name: "Tunis Auto" }, business: null }), "Tunis Auto")
    assert.equal(assignmentPlace({ scope: "SHOP", shop: null, business: null }), "A shop")
})

test("a role past its end date reads Expired", () => {
    const now = new Date("2026-10-29T00:00:00Z")
    assert.equal(assignmentState({ status: "ACTIVE", expiresAt: null }, now), "Active")
    assert.equal(assignmentState({ status: "SUSPENDED", expiresAt: null }, now), "Suspended")
    assert.equal(assignmentState({ status: "ACTIVE", expiresAt: new Date("2026-10-28T00:00:00Z") }, now), "Expired")
    assert.equal(assignmentState({ status: "ACTIVE", expiresAt: new Date("2026-11-01T00:00:00Z") }, now), "Active")
})
