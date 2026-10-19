// lib/business-choice.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { resolveBusinessChoice } from "./business-choice"

test("a first application starts a business", () => {
    assert.deepEqual(resolveBusinessChoice([], undefined), { ok: true, kind: "new" })
    assert.deepEqual(resolveBusinessChoice([], ""), { ok: true, kind: "new" })
})

test("with one business and no choice, the shop goes into it", () => {
    assert.deepEqual(resolveBusinessChoice(["b1"], undefined), { ok: true, kind: "existing", businessId: "b1" })
})

test("with several businesses a choice is required", () => {
    assert.equal(resolveBusinessChoice(["b1", "b2"], undefined).ok, false)
})

test("a chosen business must be one the person may add shops to", () => {
    assert.deepEqual(resolveBusinessChoice(["b1", "b2"], "b2"), { ok: true, kind: "existing", businessId: "b2" })
    assert.equal(resolveBusinessChoice(["b1"], "b9").ok, false)
    assert.equal(resolveBusinessChoice([], "b9").ok, false)
})

test("'new' always means a separate business", () => {
    assert.deepEqual(resolveBusinessChoice(["b1"], "new"), { ok: true, kind: "new" })
})

test("a non-string choice is treated as no choice", () => {
    assert.deepEqual(resolveBusinessChoice(["b1"], 42), { ok: true, kind: "existing", businessId: "b1" })
})
