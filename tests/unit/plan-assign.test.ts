// lib/plan-assign.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { parseAssignArgs, subscriptionDates } from "@/lib/plan-assign"

const NOW = new Date("2026-10-26T12:00:00Z")

test("the business and the plan are required, the plan key is upper-cased", () => {
    assert.equal(parseAssignArgs([]).ok, false)
    assert.equal(parseAssignArgs(["only-one"]).ok, false)
    const ok = parseAssignArgs(["biz_1", "pro"])
    assert.deepEqual(ok, { ok: true, value: { businessPublicId: "biz_1", planKey: "PRO", trialDays: null, months: null, note: null } })
})

test("options are read, checked, and cannot be mixed up", () => {
    const ok = parseAssignArgs(["b", "PRO", "--months", "12", "--note", " paid by transfer "])
    assert.deepEqual(ok.ok && ok.value, { businessPublicId: "b", planKey: "PRO", trialDays: null, months: 12, note: "paid by transfer" })
    assert.equal(parseAssignArgs(["b", "PRO", "--months", "0"]).ok, false)
    assert.equal(parseAssignArgs(["b", "PRO", "--trial-days", "x"]).ok, false)
    assert.equal(parseAssignArgs(["b", "PRO", "--trial-days", "14", "--months", "3"]).ok, false)
    assert.equal(parseAssignArgs(["b", "PRO", "--colour", "red"]).ok, false)
    assert.equal(parseAssignArgs(["b", "PRO", "--note"]).ok, false)
})

test("a trial gets an end date and no paid period", () => {
    const d = subscriptionDates({ trialDays: 14, months: null }, NOW)
    assert.equal(d.status, "TRIALING")
    assert.equal(d.trialEndsAt?.toISOString(), "2026-11-09T12:00:00.000Z")
    assert.equal(d.currentPeriodEnd, null)
})

test("a paid subscription starts now and ends after N months, or never", () => {
    const d = subscriptionDates({ trialDays: null, months: 12 }, NOW)
    assert.equal(d.status, "ACTIVE")
    assert.equal(d.currentPeriodStart?.toISOString(), NOW.toISOString())
    assert.equal(d.currentPeriodEnd?.toISOString(), "2027-10-26T12:00:00.000Z")
    assert.equal(subscriptionDates({ trialDays: null, months: null }, NOW).currentPeriodEnd, null)
})
