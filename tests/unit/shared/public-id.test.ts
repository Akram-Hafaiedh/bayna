// tests/unit/shared/public-id.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { isPublicId, publicIds } from "@/lib/shared/public-id"

test("a public id is 16 lowercase hex characters", () => {
    assert.equal(isPublicId("0123456789abcdef"), true)
    for (const v of ["", "0123456789abcde", "0123456789abcdef0", "0123456789ABCDEF", "0123456789abcdeg", "nope", null, undefined, 12, {}]) {
        assert.equal(isPublicId(v), false, String(v))
    }
})

test("a database id (a cuid) is never taken for a public id", () => {
    assert.equal(isPublicId("cmgx1abcd0000k8u2f3h9q7zw"), false)
})

test("publicIds keeps the well-formed ones and treats anything but a list as empty", () => {
    assert.deepEqual(publicIds(["0123456789abcdef", "x", 3]), ["0123456789abcdef"])
    assert.deepEqual(publicIds("0123456789abcdef"), [])
    assert.deepEqual(publicIds(undefined), [])
})
