// lib/impersonation.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    DEFAULT_MINUTES, END_PATH, MAX_MINUTES, READ_ONLY_MESSAGE, checkTarget, expiryFor, homeForViewedRole, isOpen,
    parseStart, parseViewAsCookie, timeLeft, viewAsBlock, viewAsCookieValue,
} from "@/lib/impersonation"
import { actorFromSession } from "@/lib/audit/actor"

const client = { id: "t1", status: "ACTIVE", role: "CLIENT", deletedAt: null, hasPlatformRole: false }

test("the start request needs an account, a real reason and the password", () => {
    const ok = parseStart({ userId: " abc ", reason: "  Customer cannot   see   orders ", password: "pw" })
    assert.deepEqual(ok, { ok: true, value: { userId: "abc", reason: "Customer cannot see orders", password: "pw" } })
    assert.equal(parseStart({ reason: "long enough reason", password: "pw" }).ok, false)
    assert.equal(parseStart({ userId: "a", reason: "short", password: "pw" }).ok, false)
    assert.equal(parseStart({ userId: "a", reason: "x".repeat(301), password: "pw" }).ok, false)
    assert.equal(parseStart({ userId: "a", reason: "long enough reason" }).ok, false)
    assert.equal(parseStart(null).ok, false)
})

test("only an active account that is not staff, and not yourself, can be viewed", () => {
    assert.deepEqual(checkTarget("admin1", client), { ok: true })
    assert.equal(checkTarget("t1", client).ok, false)
    assert.equal(checkTarget("admin1", { ...client, status: "SUSPENDED" }).ok, false)
    assert.equal(checkTarget("admin1", { ...client, status: "PENDING_DELETION" }).ok, false)
    assert.equal(checkTarget("admin1", { ...client, deletedAt: new Date() }).ok, false)
    assert.equal(checkTarget("admin1", { ...client, role: "ADMIN" }).ok, false)
    assert.equal(checkTarget("admin1", { ...client, hasPlatformRole: true }).ok, false)
})

test("a session lasts 30 minutes and never more than 2 hours", () => {
    const now = new Date("2026-10-29T10:00:00Z")
    assert.equal(DEFAULT_MINUTES, 30)
    assert.equal(expiryFor(now).toISOString(), "2026-10-29T10:30:00.000Z")
    assert.equal(expiryFor(now, 999).getTime() - now.getTime(), MAX_MINUTES * 60_000)
})

test("a session is open until it is ended or past its time", () => {
    const now = new Date("2026-10-29T10:00:00Z")
    const later = new Date("2026-10-29T10:10:00Z")
    assert.equal(isOpen({ endedAt: null, expiresAt: later }, now), true)
    assert.equal(isOpen({ endedAt: now, expiresAt: later }, now), false)
    assert.equal(isOpen({ endedAt: null, expiresAt: now }, now), false)
})

test("the banner shows the time left", () => {
    const now = new Date("2026-10-29T10:00:00Z")
    assert.equal(timeLeft(new Date("2026-10-29T10:12:05Z"), now), "12:05")
    assert.equal(timeLeft(new Date("2026-10-29T10:00:42Z"), now), "0:42")
    assert.equal(timeLeft(new Date("2026-10-29T09:00:00Z"), now), "0:00")
})

const LATER = new Date(Date.now() + 30 * 60_000)

test("the cookie round trips and ignores anything else", () => {
    assert.equal(viewAsCookieValue("READ_ONLY", "CLIENT", LATER), `ro.CLIENT.${LATER.getTime()}`)
    assert.deepEqual(parseViewAsCookie(`ro.COMPANY.${LATER.getTime()}`), { mode: "READ_ONLY", role: "COMPANY", expiresAt: LATER.getTime() })
    assert.deepEqual(parseViewAsCookie(`rw.CLIENT.${LATER.getTime()}`), { mode: "WRITE", role: "CLIENT", expiresAt: LATER.getTime() })
    for (const bad of ["ro.ADMIN", "ro", "", "xx.CLIENT", "ro.CLIENT.extra", "ro.CLIENT", "ro.CLIENT.123", null, undefined]) {
        assert.equal(parseViewAsCookie(bad as string | null | undefined), null)
    }
})

test("a cookie past its end time is ignored, so it cannot outlive its session", () => {
    const value = viewAsCookieValue("READ_ONLY", "CLIENT", LATER)
    assert.ok(parseViewAsCookie(value))
    assert.ok(parseViewAsCookie(value, new Date(LATER.getTime() - 1)))
    assert.equal(parseViewAsCookie(value, LATER), null)
    assert.equal(parseViewAsCookie(value, new Date(LATER.getTime() + 60_000)), null)
    // and then nothing is blocked any more
    assert.equal(viewAsBlock("POST", "/api/profile/password", parseViewAsCookie(value, new Date(LATER.getTime() + 1))), null)
})

test("while viewing read-only only reading is allowed, plus Exit and sign-out", () => {
    const ro = parseViewAsCookie(viewAsCookieValue("READ_ONLY", "CLIENT", LATER))
    assert.equal(viewAsBlock("GET", "/dashboard", ro), null)
    assert.equal(viewAsBlock("HEAD", "/api/notifications", ro), null)
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
        assert.deepEqual(viewAsBlock(method, "/api/profile/password", ro), { status: 403, error: READ_ONLY_MESSAGE })
    }
    assert.equal(viewAsBlock("POST", END_PATH, ro), null)
    assert.equal(viewAsBlock("POST", "/api/auth/signout", ro), null)
    // no cookie, or a write session (not built): nothing is blocked here
    assert.equal(viewAsBlock("POST", "/api/profile/password", null), null)
    assert.equal(viewAsBlock("POST", "/api/profile/password", parseViewAsCookie(viewAsCookieValue("WRITE", "CLIENT", LATER))), null)
})

test("the landing page is the viewed person's own home", () => {
    assert.equal(homeForViewedRole("CLIENT"), "/dashboard")
    assert.equal(homeForViewedRole("COMPANY"), "/shop")
})

test("while viewing, the real admin is the actor and the viewed person is on whose behalf", () => {
    const actor = actorFromSession({
        user: { id: "target1", name: "Sami", email: "s@x.test", role: "CLIENT" },
        impersonation: { id: "imp1", mode: "READ_ONLY", adminId: "admin1", adminName: "Support Agent" },
    })
    assert.equal(actor.actorId, "admin1")
    assert.equal(actor.actorName, "Support Agent")
    assert.equal(actor.onBehalfOfId, "target1")
    assert.equal(actor.impersonationId, "imp1")
    assert.equal(actor.readOnly, true)
    // without a session of that kind nothing changes
    const plain = actorFromSession({ user: { id: "u1", name: "Amel", email: "a@x.test", role: "CLIENT" } })
    assert.equal(plain.actorId, "u1")
    assert.equal(plain.onBehalfOfId, undefined)
    assert.equal(plain.readOnly, undefined)
})
