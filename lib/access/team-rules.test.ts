// lib/access/team-rules.test.ts
// Run: npm run test:unit
// Who may invite, change, suspend or remove whom, and which roles a person may hand out.
import { test } from "vitest"
import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "./roles"
import { effective, has, type AssignmentInput } from "./evaluate"
import { assignableRoles, checkMemberAction, missingKeys, nextStatus, parseInviteInput, parseMemberAction, teamPermission } from "./team-rules"

const role = (scope: "BUSINESS" | "SHOP", key: string) => {
    const r = SYSTEM_ROLES.find((x) => x.scope === scope && x.key === key)
    if (!r) throw new Error(`role ${scope}:${key} is not defined`)
    return r
}

/** A `can` for someone holding one shop role in shop "s1". */
function canAs(scope: "BUSINESS" | "SHOP", key: string) {
    const r = role(scope, key)
    const a: AssignmentInput =
        scope === "SHOP"
            ? { scope, providerId: "s1", businessId: null, status: "ACTIVE", expiresAt: null, grants: [], denies: [], role: { key, permissions: r.permissions } }
            : { scope, providerId: null, businessId: "b1", status: "ACTIVE", expiresAt: null, grants: [], denies: [], role: { key, permissions: r.permissions } }
    const eff = effective([a], scope === "SHOP" ? { providerId: "s1" } : { providerId: "s1", businessId: "b1" })
    return (k: string) => has(eff, k)
}

const permsOf = (scope: "BUSINESS" | "SHOP", key: string) => role(scope, key).permissions

test("each action maps to its permission key, per level", () => {
    assert.equal(teamPermission("SHOP", "invite"), "team.member.invite")
    assert.equal(teamPermission("SHOP", "set_role"), "team.member.update_role")
    assert.equal(teamPermission("SHOP", "suspend"), "team.member.suspend")
    assert.equal(teamPermission("SHOP", "reinstate"), "team.member.suspend")
    assert.equal(teamPermission("SHOP", "remove"), "team.member.remove")
    assert.equal(teamPermission("BUSINESS", "invite"), "business.team.invite")
    assert.equal(teamPermission("BUSINESS", "set_role"), "business.team.update_role")
    assert.equal(teamPermission("BUSINESS", "view"), "business.team.view")
})

test("every key the team routes ask for exists in the catalogue", () => {
    const owner = role("BUSINESS", "OWNER").permissions
    const shopOwner = role("SHOP", "OWNER").permissions
    for (const n of ["view", "invite", "set_role", "suspend", "reinstate", "remove"] as const) {
        assert.ok(shopOwner.includes(teamPermission("SHOP", n)), teamPermission("SHOP", n))
        assert.ok(owner.includes(teamPermission("BUSINESS", n)), teamPermission("BUSINESS", n))
    }
})

test("a shop manager may hand out working roles but not the owner role", () => {
    const can = canAs("SHOP", "MANAGER")
    const keys = assignableRoles(SYSTEM_ROLES.filter((r) => r.scope === "SHOP"), can).map((r) => r.key)
    assert.ok(keys.includes("ORDER_HANDLER"))
    assert.ok(keys.includes("INVENTORY_CLERK"))
    assert.ok(keys.includes("VIEWER"))
    assert.ok(keys.includes("MANAGER"))
    assert.ok(!keys.includes("OWNER"), "a manager cannot make an owner")
})

test("a shop owner may hand out every shop role", () => {
    const can = canAs("SHOP", "OWNER")
    const all = SYSTEM_ROLES.filter((r) => r.scope === "SHOP")
    assert.equal(assignableRoles(all, can).length, all.length)
})

test("a business owner may hand out every business role and every shop role", () => {
    const can = canAs("BUSINESS", "OWNER")
    const roles = SYSTEM_ROLES.filter((r) => r.scope !== "PLATFORM")
    assert.equal(assignableRoles(roles, can).length, roles.length)
})

test("an order handler could only ever hand out their own role (and has no invite permission anyway)", () => {
    const can = canAs("SHOP", "ORDER_HANDLER")
    const keys = assignableRoles(SYSTEM_ROLES.filter((r) => r.scope === "SHOP"), can).map((r) => r.key)
    assert.deepEqual(keys, ["ORDER_HANDLER"])
    assert.equal(can("team.member.invite"), false)
    assert.deepEqual(missingKeys(["order.request.accept"], can), [])
    assert.deepEqual(missingKeys(["product.price.edit"], can), ["product.price.edit"])
})

test("a manager cannot change, suspend or remove an owner", () => {
    const can = canAs("SHOP", "MANAGER")
    for (const action of [{ type: "set_role", roleKey: "VIEWER" }, { type: "suspend" }, { type: "remove" }] as const) {
        const r = checkMemberAction({
            actorUserId: "m", targetUserId: "o", targetRolePermissions: permsOf("SHOP", "OWNER"),
            newRolePermissions: permsOf("SHOP", "VIEWER"), action, can,
        })
        assert.equal(r.ok, false, action.type)
        if (!r.ok) assert.equal(r.status, 403)
    }
})

test("a manager can change a clerk to a viewer, but not to an owner", () => {
    const can = canAs("SHOP", "MANAGER")
    const base = { actorUserId: "m", targetUserId: "c", targetRolePermissions: permsOf("SHOP", "INVENTORY_CLERK"), can }
    assert.equal(checkMemberAction({ ...base, newRolePermissions: permsOf("SHOP", "VIEWER"), action: { type: "set_role", roleKey: "VIEWER" } }).ok, true)
    const r = checkMemberAction({ ...base, newRolePermissions: permsOf("SHOP", "OWNER"), action: { type: "set_role", roleKey: "OWNER" } })
    assert.equal(r.ok, false)
    assert.equal(checkMemberAction({ ...base, action: { type: "suspend" } }).ok, true)
    assert.equal(checkMemberAction({ ...base, action: { type: "remove" } }).ok, true)
})

test("an owner can make another owner", () => {
    const can = canAs("SHOP", "OWNER")
    const r = checkMemberAction({
        actorUserId: "o1", targetUserId: "m", targetRolePermissions: permsOf("SHOP", "MANAGER"),
        newRolePermissions: permsOf("SHOP", "OWNER"), action: { type: "set_role", roleKey: "OWNER" }, can,
    })
    assert.equal(r.ok, true)
})

test("nobody changes their own role or suspends themselves, but anyone may leave", () => {
    const can = canAs("SHOP", "OWNER")
    const base = { actorUserId: "o", targetUserId: "o", targetRolePermissions: permsOf("SHOP", "OWNER"), can }
    assert.equal(checkMemberAction({ ...base, newRolePermissions: permsOf("SHOP", "VIEWER"), action: { type: "set_role", roleKey: "VIEWER" } }).ok, false)
    assert.equal(checkMemberAction({ ...base, action: { type: "suspend" } }).ok, false)
    assert.equal(checkMemberAction({ ...base, action: { type: "reinstate" } }).ok, false)
    assert.equal(checkMemberAction({ ...base, action: { type: "remove" } }).ok, true) // the owner rule decides if they may leave
})

test("a set_role with an unknown role is a 400", () => {
    const can = canAs("SHOP", "OWNER")
    const r = checkMemberAction({
        actorUserId: "o", targetUserId: "m", targetRolePermissions: permsOf("SHOP", "MANAGER"),
        action: { type: "set_role", roleKey: "NOPE" }, can,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.status, 400)
})

test("a business accountant cannot manage a business owner", () => {
    const can = canAs("BUSINESS", "ACCOUNTANT")
    const r = checkMemberAction({
        actorUserId: "a", targetUserId: "o", targetRolePermissions: permsOf("BUSINESS", "OWNER"),
        action: { type: "remove" }, can,
    })
    assert.equal(r.ok, false)
})

test("invite input: trims and lowercases the email, needs a scope and a role", () => {
    const r = parseInviteInput({ scope: "SHOP", email: "  Sami@Mail.COM ", roleKey: "MANAGER" })
    assert.deepEqual(r, { ok: true, value: { scope: "SHOP", email: "sami@mail.com", roleKey: "MANAGER", targetId: null } })
    assert.equal(parseInviteInput({ scope: "PLATFORM", email: "a@b.co", roleKey: "ADMIN" }).ok, false)
    assert.equal(parseInviteInput({ scope: "SHOP", email: "nope", roleKey: "MANAGER" }).ok, false)
    assert.equal(parseInviteInput({ scope: "SHOP", email: "a@b.co", roleKey: "manager" }).ok, false)
    assert.equal(parseInviteInput(null).ok, false)
    assert.equal(parseInviteInput({ scope: "BUSINESS", email: "a@b.co" }).ok, false)
})

test("invite input: an optional target names the shop or business", () => {
    const r = parseInviteInput({ scope: "SHOP", email: "a@b.co", roleKey: "VIEWER", targetId: "cmv6ljwp30001fcu6o257d3tu" })
    assert.deepEqual(r, { ok: true, value: { scope: "SHOP", email: "a@b.co", roleKey: "VIEWER", targetId: "cmv6ljwp30001fcu6o257d3tu" } })
    assert.equal(parseInviteInput({ scope: "SHOP", email: "a@b.co", roleKey: "VIEWER", targetId: null }).ok, true)
    assert.equal(parseInviteInput({ scope: "SHOP", email: "a@b.co", roleKey: "VIEWER", targetId: "../x" }).ok, false)
    assert.equal(parseInviteInput({ scope: "SHOP", email: "a@b.co", roleKey: "VIEWER", targetId: 5 }).ok, false)
})

test("status after an action", () => {
    assert.equal(nextStatus("suspend"), "SUSPENDED")
    assert.equal(nextStatus("reinstate"), "ACTIVE")
    assert.equal(nextStatus("remove"), null)
    assert.equal(nextStatus("set_role"), null)
})

test("member action input", () => {
    assert.deepEqual(parseMemberAction({ action: "suspend" }), { ok: true, value: { type: "suspend" } })
    assert.deepEqual(parseMemberAction({ action: "reinstate" }), { ok: true, value: { type: "reinstate" } })
    assert.deepEqual(parseMemberAction({ action: "set_role", roleKey: "VIEWER" }), { ok: true, value: { type: "set_role", roleKey: "VIEWER" } })
    assert.equal(parseMemberAction({ action: "set_role" }).ok, false)
    assert.equal(parseMemberAction({ action: "delete" }).ok, false)
    assert.equal(parseMemberAction(undefined).ok, false)
})
