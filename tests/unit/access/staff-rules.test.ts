// lib/access/staff-rules.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    STAFF_ACCOUNT_ERROR, checkStaffAccount, checkStaffInvitee, checkStaffOwnerRule, isPlatformRole, parseStaffInvite, staffPermission,
    type StaffAssignmentRow,
} from "@/lib/access/staff-rules"
import { ALL_PLATFORM_KEYS } from "@/lib/access/catalogue"

const now = new Date("2026-10-28T10:00:00Z")
const row = (id: string, userId: string, permissions: string[], over: Partial<StaffAssignmentRow> = {}): StaffAssignmentRow => ({
    id,
    userId,
    status: "ACTIVE",
    expiresAt: null,
    role: { permissions },
    user: { status: "ACTIVE", deletedAt: null },
    ...over,
})
const OWNER = ["*"]
const SUPPORT = ["support.ticket.view_all"]

test("an invitation needs a valid email and a role", () => {
    assert.deepEqual(parseStaffInvite({ email: " Sami@Mail.com ", roleId: "abc123" }), { ok: true, value: { email: "sami@mail.com", roleId: "abc123" } })
    assert.equal(parseStaffInvite({ email: "nope", roleId: "abc" }).ok, false)
    assert.equal(parseStaffInvite({ email: "a@b.co" }).ok, false)
    assert.equal(parseStaffInvite({ email: "a@b.co", roleId: "bad id!" }).ok, false)
    assert.equal(parseStaffInvite(null).ok, false)
})

test("only a role with no business and no shop is a platform role", () => {
    assert.equal(isPlatformRole({ businessId: null, shopId: null }), true)
    assert.equal(isPlatformRole({ businessId: "b1", shopId: null }), false)
    assert.equal(isPlatformRole({ businessId: null, shopId: "s1" }), false)
})

test("an account that works in a shop or business, or owns one, cannot be staff", () => {
    assert.deepEqual(checkStaffAccount({ worksInShopOrBusiness: false, ownsAShop: false }), { ok: true })
    assert.deepEqual(checkStaffAccount({ worksInShopOrBusiness: true, ownsAShop: false }), { ok: false, error: STAFF_ACCOUNT_ERROR })
    assert.deepEqual(checkStaffAccount({ worksInShopOrBusiness: false, ownsAShop: true }), { ok: false, error: STAFF_ACCOUNT_ERROR })
})

test("the permission of each staff action exists in the catalogue", () => {
    const keys = new Set<string>(ALL_PLATFORM_KEYS)
    for (const a of ["view", "invite", "set_role", "suspend", "reinstate", "remove"] as const) {
        assert.ok(keys.has(staffPermission(a)), staffPermission(a))
    }
    assert.equal(staffPermission("invite"), "access.assignment.grant")
    assert.equal(staffPermission("set_role"), "access.assignment.grant")
    assert.equal(staffPermission("remove"), "access.assignment.revoke")
})

test("an invitation cannot go to yourself, an inactive account or someone already on the staff", () => {
    assert.deepEqual(checkStaffInvitee({ inviteeEmail: "a@x.co", actorEmail: "A@x.co", existing: null }).ok, false)
    assert.deepEqual(checkStaffInvitee({ inviteeEmail: "a@x.co", actorEmail: "b@x.co", existing: { status: "SUSPENDED", alreadyStaff: false } }).ok, false)
    assert.deepEqual(checkStaffInvitee({ inviteeEmail: "a@x.co", actorEmail: "b@x.co", existing: { status: "ACTIVE", alreadyStaff: true } }).ok, false)
    assert.deepEqual(checkStaffInvitee({ inviteeEmail: "a@x.co", actorEmail: "b@x.co", existing: { status: "ACTIVE", alreadyStaff: false } }), { ok: true })
    assert.deepEqual(checkStaffInvitee({ inviteeEmail: "a@x.co", actorEmail: "b@x.co", existing: null }), { ok: true })
})

test("the only owner cannot be removed, suspended or given a lesser role", () => {
    const rows = [row("a1", "u1", OWNER), row("a2", "u2", SUPPORT)]
    for (const change of [
        { type: "remove" as const, assignmentId: "a1" },
        { type: "suspend" as const, assignmentId: "a1" },
        { type: "set_role" as const, assignmentId: "a1", newPermissions: SUPPORT },
    ]) {
        const res = checkStaffOwnerRule(rows, change, now)
        assert.equal(res.ok, false)
    }
})

test("with a second live owner, an owner can be changed", () => {
    const rows = [row("a1", "u1", OWNER), row("a2", "u2", OWNER)]
    assert.deepEqual(checkStaffOwnerRule(rows, { type: "remove", assignmentId: "a1" }, now), { ok: true })
    assert.deepEqual(checkStaffOwnerRule(rows, { type: "suspend", assignmentId: "a1" }, now), { ok: true })
})

test("a second owner who is suspended, expired or has a closed account does not count", () => {
    const base = row("a1", "u1", OWNER)
    for (const other of [
        row("a2", "u2", OWNER, { status: "SUSPENDED" }),
        row("a2", "u2", OWNER, { expiresAt: new Date("2026-01-01") }),
        row("a2", "u2", OWNER, { user: { status: "SUSPENDED", deletedAt: null } }),
    ]) {
        assert.equal(checkStaffOwnerRule([base, other], { type: "remove", assignmentId: "a1" }, now).ok, false)
    }
})

test("changing someone who is not an owner always passes", () => {
    const rows = [row("a1", "u1", OWNER), row("a2", "u2", SUPPORT)]
    assert.deepEqual(checkStaffOwnerRule(rows, { type: "remove", assignmentId: "a2" }, now), { ok: true })
    assert.deepEqual(checkStaffOwnerRule(rows, { type: "suspend", assignmentId: "a2" }, now), { ok: true })
})

test("a person with two owner roles is one owner", () => {
    const rows = [row("a1", "u1", OWNER), row("a2", "u1", OWNER)]
    // removing one of the two leaves the same person as owner
    assert.deepEqual(checkStaffOwnerRule(rows, { type: "remove", assignmentId: "a1" }, now), { ok: true })
})

test("an unknown assignment is refused", () => {
    assert.equal(checkStaffOwnerRule([row("a1", "u1", OWNER)], { type: "remove", assignmentId: "zzz" }, now).ok, false)
})
