// lib/access/invite-token.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { hashInviteToken, INVITE_TTL_DAYS, inviteExpiry, inviteState, isPlausibleToken, newInviteToken } from "./invite-token"

test("a new token is 43 URL-safe characters and different every time", () => {
    const a = newInviteToken()
    const b = newInviteToken()
    assert.equal(a.length, 43)
    assert.match(a, /^[A-Za-z0-9_-]+$/)
    assert.notEqual(a, b)
    assert.equal(isPlausibleToken(a), true)
})

test("the stored hash is stable, hex, and not the token", () => {
    const t = newInviteToken()
    assert.equal(hashInviteToken(t), hashInviteToken(t))
    assert.match(hashInviteToken(t), /^[0-9a-f]{64}$/)
    assert.notEqual(hashInviteToken(t), t)
    assert.notEqual(hashInviteToken(t), hashInviteToken(newInviteToken()))
})

test("garbage is not a plausible token", () => {
    for (const bad of ["", "abc", "x".repeat(42), "x".repeat(44), "../../etc/passwd", "a".repeat(42) + "!"]) {
        assert.equal(isPlausibleToken(bad), false, bad)
    }
})

test("an invite lasts seven days", () => {
    const now = new Date("2026-10-18T10:00:00Z")
    assert.equal(INVITE_TTL_DAYS, 7)
    assert.equal(inviteExpiry(now).toISOString(), "2026-10-25T10:00:00.000Z")
})

test("state: pending, expired at the exact expiry moment, revoked, accepted", () => {
    const now = new Date("2026-10-18T10:00:00Z")
    const later = new Date("2026-10-19T10:00:00Z")
    assert.equal(inviteState({ status: "PENDING", expiresAt: later }, now), "pending")
    assert.equal(inviteState({ status: "PENDING", expiresAt: now }, now), "expired")
    assert.equal(inviteState({ status: "PENDING", expiresAt: new Date("2026-10-01T00:00:00Z") }, now), "expired")
    assert.equal(inviteState({ status: "REVOKED", expiresAt: later }, now), "revoked")
    assert.equal(inviteState({ status: "ACCEPTED", expiresAt: new Date("2026-10-01T00:00:00Z") }, now), "accepted")
})
