// lib/email-input.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { normalizeEmail, parseEmail } from "@/lib/auth/email-input"

test("normalizeEmail trims and lowercases", () => {
    assert.equal(normalizeEmail("  Sami@Mail.COM "), "sami@mail.com")
})

test("parseEmail accepts normal addresses and normalises them", () => {
    assert.deepEqual(parseEmail(" Sami.Ben@Mail.tn "), { ok: true, value: "sami.ben@mail.tn" })
    assert.deepEqual(parseEmail("a+b@sub.example.com"), { ok: true, value: "a+b@sub.example.com" })
})

test("parseEmail refuses things that are not addresses", () => {
    for (const bad of ["", "   ", "nope", "a@b", "a@@b.com", "a b@c.com", "@c.com", "a@.com", null, undefined, 42]) {
        assert.equal(parseEmail(bad).ok, false, String(bad))
    }
    assert.equal(parseEmail(`${"a".repeat(250)}@b.com`).ok, false)
})
