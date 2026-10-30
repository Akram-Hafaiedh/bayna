// lib/terms.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { ACCEPT_ERROR, parseAcceptance } from "@/lib/shared/terms"
import { LEGAL_VERSION, formatLegalDate, missingSiteDetails } from "@/lib/shared/site"

test("only an explicit true accepts, and the current version is recorded", () => {
    assert.deepEqual(parseAcceptance(true), { ok: true, version: LEGAL_VERSION })
    for (const v of [false, undefined, null, "true", 1, "on", {}]) {
        assert.deepEqual(parseAcceptance(v), { ok: false, error: ACCEPT_ERROR })
    }
})

test("the legal version is a date and prints as one", () => {
    assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(formatLegalDate("2026-10-27"), "27 October 2026")
    assert.equal(formatLegalDate("2027-01-05"), "5 January 2027")
})

test("the team is told which company details are missing", () => {
    assert.deepEqual(missingSiteDetails({ companyName: null, companyAddress: null, contactEmail: null }), [
        "NEXT_PUBLIC_COMPANY_NAME", "NEXT_PUBLIC_COMPANY_ADDRESS", "NEXT_PUBLIC_CONTACT_EMAIL",
    ])
    assert.deepEqual(missingSiteDetails({ companyName: "X", companyAddress: "Y", contactEmail: "a@b.tn" }), [])
})
