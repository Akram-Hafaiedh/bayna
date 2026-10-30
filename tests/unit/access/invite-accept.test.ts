// lib/access/invite-accept.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { ACCEPT_ERRORS, checkAcceptable } from "@/lib/access/invite-accept"

const base = { state: "pending" as const, inviteEmail: "sami@x.tn", userEmail: "sami@x.tn", targetGone: false, accountActive: true }

test("the right person with a live invitation may accept", () => {
    assert.deepEqual(checkAcceptable(base), { ok: true })
})

test("email is compared without regard to case or spaces", () => {
    assert.equal(checkAcceptable({ ...base, userEmail: "  Sami@X.TN " }).ok, true)
})

test("a different account is refused and told which address to use", () => {
    const r = checkAcceptable({ ...base, userEmail: "other@x.tn" })
    assert.equal(r.ok, false)
    if (!r.ok) {
        assert.equal(r.status, 403)
        assert.match(r.error, /sent to sami@x\.tn/)
        assert.match(r.error, /signed in as other@x\.tn/)
    }
})

test("expired, cancelled and used invitations are gone (410) with their own message", () => {
    for (const state of ["expired", "revoked", "accepted"] as const) {
        const r = checkAcceptable({ ...base, state })
        assert.equal(r.ok, false, state)
        if (!r.ok) {
            assert.equal(r.status, 410)
            assert.equal(r.error, ACCEPT_ERRORS[state])
        }
    }
})

test("a closed account cannot accept, whatever else is true", () => {
    const r = checkAcceptable({ ...base, accountActive: false, state: "expired" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
})

test("a deleted shop or business cannot be joined", () => {
    const r = checkAcceptable({ ...base, targetGone: true })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error, ACCEPT_ERRORS.gone)
})

test("the wrong address is reported before a missing target", () => {
    const r = checkAcceptable({ ...base, userEmail: "other@x.tn", targetGone: true })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 403)
})
