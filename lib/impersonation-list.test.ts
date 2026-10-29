// lib/impersonation-list.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    DEFAULT_SESSION_PAGE_SIZE, NO_SESSION_QUERY, buildSessionsHref, endedLabel, isSessionOpen, parseSessionQuery, sessionWhere,
} from "./impersonation-list"

const NOW = new Date("2026-10-29T10:00:00Z")
const later = new Date("2026-10-29T10:30:00Z")
const earlier = new Date("2026-10-29T09:30:00Z")

test("the address is read with safe defaults", () => {
    assert.deepEqual(parseSessionQuery({}), NO_SESSION_QUERY)
    assert.deepEqual(parseSessionQuery({ state: "open", page: "3", pageSize: "50" }), { state: "open", page: 3, pageSize: 50 })
    assert.deepEqual(parseSessionQuery({ state: "nonsense", page: "-2", pageSize: "7" }), { state: "all", page: 1, pageSize: DEFAULT_SESSION_PAGE_SIZE })
    assert.deepEqual(parseSessionQuery(new URLSearchParams("state=ended&page=2")), { state: "ended", page: 2, pageSize: DEFAULT_SESSION_PAGE_SIZE })
})

test("links leave out the defaults and go back to page 1 unless the page changes", () => {
    assert.equal(buildSessionsHref(NO_SESSION_QUERY), "?")
    assert.equal(buildSessionsHref(NO_SESSION_QUERY, { state: "open" }), "?state=open")
    const deep = { state: "open" as const, page: 4, pageSize: 25 }
    assert.equal(buildSessionsHref(deep, { state: "ended" }), "?state=ended")
    assert.equal(buildSessionsHref(deep, { page: 5 }), "?state=open&page=5")
    assert.equal(buildSessionsHref(deep, { pageSize: 50 }), "?state=open&pageSize=50")
})

test("a session is open until it is ended or its time is up", () => {
    assert.equal(isSessionOpen({ endedAt: null, expiresAt: later }, NOW), true)
    assert.equal(isSessionOpen({ endedAt: null, expiresAt: earlier }, NOW), false)
    assert.equal(isSessionOpen({ endedAt: null, expiresAt: NOW }, NOW), false)
    assert.equal(isSessionOpen({ endedAt: earlier, expiresAt: later }, NOW), false)
    assert.equal(isSessionOpen({ endedAt: earlier.toISOString(), expiresAt: later.toISOString() }, NOW), false)
})

test("the filter matches the same rule", () => {
    assert.deepEqual(sessionWhere({ ...NO_SESSION_QUERY, state: "all" }, NOW), {})
    assert.deepEqual(sessionWhere({ ...NO_SESSION_QUERY, state: "open" }, NOW), { endedAt: null, expiresAt: { gt: NOW } })
    assert.deepEqual(sessionWhere({ ...NO_SESSION_QUERY, state: "ended" }, NOW), { OR: [{ endedAt: { not: null } }, { expiresAt: { lte: NOW } }] })
})

test("the status is said in words", () => {
    assert.equal(endedLabel({ endedAt: null, expiresAt: later, endedBy: null }, NOW), "Open")
    assert.equal(endedLabel({ endedAt: earlier, expiresAt: later, endedBy: "ADMIN" }, NOW), "Ended by the staff member")
    assert.equal(endedLabel({ endedAt: earlier, expiresAt: later, endedBy: "SIGNED_OUT" }, NOW), "Staff member signed out")
    assert.equal(endedLabel({ endedAt: earlier, expiresAt: later, endedBy: "STAFF" }, NOW), "Ended by another staff member")
    assert.equal(endedLabel({ endedAt: earlier, expiresAt: later, endedBy: "EXPIRED" }, NOW), "Time ran out")
    // never closed, but past its time
    assert.equal(endedLabel({ endedAt: null, expiresAt: earlier, endedBy: null }, NOW), "Time ran out")
})
