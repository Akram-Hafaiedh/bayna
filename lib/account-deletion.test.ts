// lib/account-deletion.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    ANONYMISED_NAME, GRACE_DAYS, anonymisedEmail, blocker, checkCanRequest, daysLeft, isDue, parseDeletionRequest, purgeDate, signInCancelsDeletion,
} from "./account-deletion"

const asked = new Date("2026-10-28T12:00:00Z")

test("the account is erased after the grace period, and not before", () => {
    assert.equal(GRACE_DAYS, 14)
    assert.equal(purgeDate(asked).toISOString(), "2026-11-11T12:00:00.000Z")
    assert.equal(isDue(asked, new Date("2026-11-11T11:59:59Z")), false)
    assert.equal(isDue(asked, new Date("2026-11-11T12:00:00Z")), true)
    assert.equal(isDue(asked, new Date("2027-01-01T00:00:00Z")), true)
})

test("the days left are rounded up and never negative", () => {
    assert.equal(daysLeft(asked, asked), 14)
    assert.equal(daysLeft(asked, new Date("2026-11-10T13:00:00Z")), 1)
    assert.equal(daysLeft(asked, new Date("2026-12-01T00:00:00Z")), 0)
})

test("signing in cancels a pending deletion and nothing else", () => {
    assert.equal(signInCancelsDeletion("PENDING_DELETION"), true)
    for (const s of ["ACTIVE", "SUSPENDED", "BANNED"]) assert.equal(signInCancelsDeletion(s), false)
})

test("the request needs the password", () => {
    assert.deepEqual(parseDeletionRequest({ password: "secret" }), { ok: true, value: { password: "secret" } })
    assert.equal(parseDeletionRequest({}).ok, false)
    assert.equal(parseDeletionRequest({ password: "" }).ok, false)
    assert.equal(parseDeletionRequest({ password: 123 }).ok, false)
    assert.equal(parseDeletionRequest(null).ok, false)
})

test("only an active account without blockers may be deleted", () => {
    assert.deepEqual(checkCanRequest({ status: "ACTIVE", blockers: [] }), { ok: true })
    for (const status of ["SUSPENDED", "BANNED", "PENDING_DELETION"]) {
        assert.equal(checkCanRequest({ status, blockers: [] }).ok, false)
    }
    const res = checkCanRequest({ status: "ACTIVE", blockers: [blocker.owner("Demo Shop"), blocker.platform()] })
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.blockers.length, 2)
})

test("an anonymised account gets an address that cannot receive mail or clash", () => {
    assert.equal(anonymisedEmail("abc123"), "deleted-abc123@deleted.invalid")
    assert.notEqual(anonymisedEmail("a"), anonymisedEmail("b"))
    assert.equal(ANONYMISED_NAME, "Deleted user")
})

test("each blocker names the thing to hand over", () => {
    assert.match(blocker.owner("Carthage Group"), /Carthage Group/)
    assert.match(blocker.application("Tunis Auto"), /Tunis Auto/)
    assert.match(blocker.platform(), /platform/)
})
