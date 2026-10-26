// lib/reset-token.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { hashResetToken, newResetToken } from "./reset-token"

test("the stored value is the hash, not the secret in the link", () => {
    const { token, hash } = newResetToken()
    assert.notEqual(hash, token)
    assert.equal(hash, hashResetToken(token))
    assert.match(hash, /^[0-9a-f]{64}$/)
})

test("each token is different and the same token always gives the same hash", () => {
    const a = newResetToken()
    const b = newResetToken()
    assert.notEqual(a.token, b.token)
    assert.notEqual(a.hash, b.hash)
    assert.equal(hashResetToken("abc"), hashResetToken("abc"))
})
