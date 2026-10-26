// lib/user-status.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { checkTarget, messageForSignInCode, parseReason, signInBlockFor, userActions, userMove } from "./user-status"

test("only an active account can be suspended, and only a suspended one reinstated", () => {
    assert.equal(userMove("suspend", "ACTIVE"), "SUSPENDED")
    assert.equal(userMove("suspend", "SUSPENDED"), null)
    assert.equal(userMove("suspend", "BANNED"), null)
    assert.equal(userMove("reinstate", "SUSPENDED"), "ACTIVE")
    assert.equal(userMove("reinstate", "ACTIVE"), null)
})

test("the list offers each state its own actions", () => {
    assert.deepEqual(userActions("ACTIVE", false), ["suspend", "revoke_sessions", "reset_password"])
    assert.deepEqual(userActions("SUSPENDED", false), ["reinstate", "reset_password"])
    assert.deepEqual(userActions("BANNED", false), [])
    assert.deepEqual(userActions("PENDING_DELETION", false), [])
})

test("nobody gets actions on their own account", () => {
    assert.deepEqual(userActions("ACTIVE", true), [])
    assert.equal(checkTarget("a", "a").ok, false)
    assert.equal(checkTarget("a", "b").ok, true)
})

test("a suspension needs a reason of a sensible length", () => {
    assert.equal(parseReason("").ok, false)
    assert.equal(parseReason("  ab ").ok, false)
    assert.equal(parseReason(undefined).ok, false)
    assert.equal(parseReason("x".repeat(301)).ok, false)
    const ok = parseReason("  Fake   orders  reported ")
    assert.deepEqual(ok, { ok: true, value: "Fake orders reported" })
})

test("a blocked account tells the person why at sign-in, an open one does not", () => {
    assert.equal(signInBlockFor("ACTIVE"), null)
    assert.equal(signInBlockFor("SUSPENDED")?.code, "account_suspended")
    assert.equal(signInBlockFor("BANNED")?.code, "account_banned")
    assert.equal(signInBlockFor("PENDING_DELETION")?.code, "account_pending_deletion")
    assert.equal(signInBlockFor("SOMETHING_ELSE"), null)
})

test("the sign-in page maps each code to its message and ignores other errors", () => {
    assert.match(messageForSignInCode("account_suspended") ?? "", /suspended/)
    assert.match(messageForSignInCode("account_banned") ?? "", /closed/)
    assert.match(messageForSignInCode("account_pending_deletion") ?? "", /deletion/)
    assert.equal(messageForSignInCode("credentials"), null)
    assert.equal(messageForSignInCode(undefined), null)
})
