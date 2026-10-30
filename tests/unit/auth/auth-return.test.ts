// tests/unit/auth/auth-return.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { readAuthReturn } from "@/lib/auth/auth-return"

test("reads the way back and the invited address", () => {
    assert.deepEqual(readAuthReturn("?next=%2Finvite%2Fabc&email=Sami%40Mail.com"), { next: "/invite/abc", email: "sami@mail.com" })
})

test("ignores anything that leaves the site or is not an address", () => {
    assert.deepEqual(readAuthReturn("?next=https%3A%2F%2Fevil.example&email=nope"), { next: null, email: null })
    assert.deepEqual(readAuthReturn("?next=%2F%2Fevil.example"), { next: null, email: null })
    assert.deepEqual(readAuthReturn(""), { next: null, email: null })
})
