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
    assert.equal(userMove("reinstate", "BANNED"), null)
})

test("an active or suspended account can be banned, and only a banned one unbanned", () => {
    assert.equal(userMove("ban", "ACTIVE"), "BANNED")
    assert.equal(userMove("ban", "SUSPENDED"), "BANNED")
    assert.equal(userMove("ban", "BANNED"), null)
    assert.equal(userMove("ban", "PENDING_DELETION"), null)
    assert.equal(userMove("unban", "BANNED"), "ACTIVE")
    assert.equal(userMove("unban", "ACTIVE"), null)
    assert.equal(userMove("unban", "SUSPENDED"), null)
})

test("the list offers each state its own actions", () => {
    assert.deepEqual(userActions("ACTIVE", false), ["suspend", "ban", "revoke_sessions", "reset_password"])
    assert.deepEqual(userActions("SUSPENDED", false), ["reinstate", "ban", "reset_password"])
    assert.deepEqual(userActions("BANNED", false), ["unban"])
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

test("the reason is asked for in the words of the action", () => {
    assert.match((parseReason("", "suspended") as { error: string }).error, /suspended/)
    assert.match((parseReason("", "banned") as { error: string }).error, /banned/)
    assert.deepEqual(parseReason("Repeated fraud", "banned"), { ok: true, value: "Repeated fraud" })
})

test("a blocked account tells the person why at sign-in, an open one does not", () => {
    assert.equal(signInBlockFor("ACTIVE"), null)
    assert.equal(signInBlockFor("SUSPENDED")?.code, "account_suspended")
    assert.equal(signInBlockFor("BANNED")?.code, "account_banned")
    // Signing in cancels a pending deletion, so it is not a block
    assert.equal(signInBlockFor("PENDING_DELETION"), null)
    assert.equal(signInBlockFor("SOMETHING_ELSE"), null)
})

test("the sign-in page maps each code to its message and ignores other errors", () => {
    assert.match(messageForSignInCode("account_suspended") ?? "", /suspended/)
    assert.match(messageForSignInCode("account_banned") ?? "", /closed/)
    // A pending deletion is cancelled by signing in, so it has no sign-in message
    assert.equal(messageForSignInCode("account_pending_deletion"), null)
    assert.equal(messageForSignInCode("credentials"), null)
    assert.equal(messageForSignInCode(undefined), null)
})
