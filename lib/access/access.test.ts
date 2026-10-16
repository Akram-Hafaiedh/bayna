// lib/access/access.test.ts
// Run: npm run test:unit   (Vitest)
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    ALL_CLIENT_KEYS,
    ALL_PLATFORM_KEYS,
    ALL_SHOP_KEYS,
    isKnownKey,
} from "./catalogue"
import { expandPatterns, matchesPattern } from "./match"
import { SYSTEM_ROLES, validateSystemRoles } from "./roles"
import { AssignmentInput, can, effective, has, listAllowed, ungrantable } from "./evaluate"

const role = (key: string) => {
    const r = SYSTEM_ROLES.find((x) => x.key === key)
    if (!r) throw new Error(`role ${key} is not defined`)
    return r
}

const assign = (roleKey: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => {
    const r = role(roleKey)
    return {
        scope: r.scope,
        providerId: r.scope === "SHOP" ? "shopA" : null,
        status: "ACTIVE",
        expiresAt: null,
        grants: [],
        denies: [],
        role: { key: r.key, permissions: r.permissions },
        ...extra,
    }
}

// ---- catalogue --------------------------------------------------------------------------------

test("catalogue keys are unique inside each scope and shaped module.resource.action", () => {
    for (const keys of [ALL_SHOP_KEYS, ALL_PLATFORM_KEYS, ALL_CLIENT_KEYS]) {
        assert.equal(new Set(keys).size, keys.length)
        for (const k of keys) assert.match(k, /^[a-z_]+\.[a-z_]+\.[a-z_]+$/, k)
    }
})

test("the catalogue is wide: every module from the design is present", () => {
    assert.ok(ALL_SHOP_KEYS.length >= 70, `shop keys: ${ALL_SHOP_KEYS.length}`)
    assert.ok(ALL_PLATFORM_KEYS.length >= 95, `platform keys: ${ALL_PLATFORM_KEYS.length}`)
    for (const k of ["product.price.edit", "order.request.refund", "team.member.transfer_ownership"]) {
        assert.ok(ALL_SHOP_KEYS.includes(k as never), k)
    }
    for (const k of ["impersonation.session.start_readonly", "support.ticket.merge", "access.assignment.grant"]) {
        assert.ok(ALL_PLATFORM_KEYS.includes(k as never), k)
    }
})

test("isKnownKey accepts * only for platform roles", () => {
    assert.equal(isKnownKey("PLATFORM", "*"), true)
    assert.equal(isKnownKey("SHOP", "*"), false)
    assert.equal(isKnownKey("SHOP", "product.price.edit"), true)
    assert.equal(isKnownKey("SHOP", "user.account.view"), false)
})

// ---- patterns ---------------------------------------------------------------------------------

test("matchesPattern handles *, trailing * and middle *", () => {
    assert.equal(matchesPattern("*", "a.b.c"), true)
    assert.equal(matchesPattern("catalog.*", "catalog.item.view"), true)
    assert.equal(matchesPattern("catalog.*", "catalog"), false)
    assert.equal(matchesPattern("catalog.*", "catalogue.item.view"), false)
    assert.equal(matchesPattern("access.*.view", "access.role.view"), true)
    assert.equal(matchesPattern("access.*.view", "access.role.update"), false)
    assert.equal(matchesPattern("a.b.c", "a.b.c"), true)
    assert.equal(matchesPattern("a.b.c", "a.b.cd"), false)
    assert.equal(matchesPattern("a.b", "a.b.c"), false)
})

test("expandPatterns applies excludes", () => {
    const out = expandPatterns(["x.a.view", "x.a.edit", "y.b.view"], ["x.*"], ["x.a.edit"])
    assert.deepEqual(out, ["x.a.view"])
})

// ---- system roles -----------------------------------------------------------------------------

test("system role definitions are valid", () => {
    assert.deepEqual(validateSystemRoles(), [])
})

test("only SUPER_ADMIN stores the wildcard; every other role stores explicit keys", () => {
    for (const r of SYSTEM_ROLES) {
        if (r.key === "SUPER_ADMIN") assert.deepEqual(r.permissions, ["*"])
        else assert.ok(!r.permissions.includes("*"), r.key)
    }
})

test("ADMIN holds everything except access.*, write impersonation and system jobs", () => {
    const admin = role("ADMIN").permissions
    assert.ok(admin.includes("user.account.suspend"))
    assert.ok(admin.includes("impersonation.session.start_readonly"))
    assert.ok(!admin.includes("impersonation.session.start_write"))
    assert.ok(!admin.includes("system.job.run"))
    assert.ok(!admin.some((k) => k.startsWith("access.")))
})

test("shop roles: price editing belongs to owner and manager only", () => {
    const holders = SYSTEM_ROLES.filter((r) => r.scope === "SHOP" && r.permissions.includes("product.price.edit"))
    assert.deepEqual(holders.map((r) => r.key).sort(), ["MANAGER", "OWNER"])
})

test("MANAGER cannot transfer ownership, manage billing, edit legal details or touch integrations", () => {
    const m = role("MANAGER").permissions
    for (const k of ["team.member.transfer_ownership", "billing.subscription.manage", "shop.profile.edit_legal", "integration.api_key.manage", "integration.webhook.manage"]) {
        assert.ok(!m.includes(k), k)
    }
    assert.ok(m.includes("team.member.invite"))
})

test("support agent cannot delete or merge tickets; support lead can merge", () => {
    const agent = role("SUPPORT_AGENT").permissions
    assert.ok(!agent.includes("support.ticket.delete"))
    assert.ok(!agent.includes("support.ticket.merge"))
    assert.ok(agent.includes("impersonation.session.start_readonly"))
    assert.ok(role("SUPPORT_LEAD").permissions.includes("support.ticket.merge"))
})

// ---- evaluation -------------------------------------------------------------------------------

test("default deny: no assignments, no access", () => {
    assert.equal(can([], "catalog.item.view"), false)
    assert.equal(can([], "product.listing.view", { providerId: "shopA" }), false)
})

test("platform check uses platform assignments only; shop check uses that shop only", () => {
    const owner = assign("OWNER")
    const admin = assign("ADMIN")
    assert.equal(can([owner], "product.listing.create"), false, "shop role does not apply to a platform check")
    assert.equal(can([owner], "product.listing.create", { providerId: "shopA" }), true)
    assert.equal(can([owner], "product.listing.create", { providerId: "shopB" }), false, "other shop")
    assert.equal(can([admin], "catalog.item.view", { providerId: "shopA" }), false, "platform role does not apply inside a shop")
    assert.equal(can([admin], "catalog.item.view"), true)
})

test("the same key means different things in shop and platform scope", () => {
    const handler = assign("ORDER_HANDLER")
    assert.equal(can([handler], "order.request.view_all", { providerId: "shopA" }), true)
    assert.equal(can([handler], "order.request.view_all"), false)
})

test("SUPER_ADMIN can do anything on the platform, but not inside a shop it has no assignment for", () => {
    const sa = assign("SUPER_ADMIN")
    assert.equal(can([sa], "anything.at.all"), true)
    assert.equal(can([sa], "product.listing.create", { providerId: "shopA" }), false)
})

test("grants add keys and denies remove them; deny wins over role and grants", () => {
    const clerk = assign("INVENTORY_CLERK", { grants: ["product.price.edit"] })
    assert.equal(can([clerk], "product.price.edit", { providerId: "shopA" }), true)
    const denied = assign("INVENTORY_CLERK", { grants: ["product.price.edit"], denies: ["product.price.edit", "product.listing.edit"] })
    assert.equal(can([denied], "product.price.edit", { providerId: "shopA" }), false)
    assert.equal(can([denied], "product.listing.edit", { providerId: "shopA" }), false)
    assert.equal(can([denied], "product.listing.create", { providerId: "shopA" }), true)
})

test("a deny beats the SUPER_ADMIN wildcard", () => {
    const sa = assign("SUPER_ADMIN", { denies: ["user.account.delete"] })
    assert.equal(can([sa], "user.account.delete"), false)
    assert.equal(can([sa], "user.account.view"), true)
})

test("a deny on one assignment applies even when another assignment grants the key", () => {
    const a = assign("MANAGER", { denies: ["product.price.edit"] })
    const b = assign("OWNER")
    assert.equal(can([a, b], "product.price.edit", { providerId: "shopA" }), false)
})

test("suspended, invited and expired assignments grant nothing", () => {
    const now = new Date("2026-10-15T12:00:00Z")
    const key = "product.listing.view"
    const ctx = { providerId: "shopA" }
    assert.equal(can([assign("VIEWER", { status: "SUSPENDED" })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { status: "INVITED" })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { expiresAt: new Date("2026-10-15T11:59:59Z") })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { expiresAt: new Date("2026-10-15T12:00:01Z") })], key, ctx, now), true)
})

test("a person with two shops gets each shop's own permissions", () => {
    const a = assign("OWNER", { providerId: "shopA" })
    const b = assign("VIEWER", { providerId: "shopB" })
    assert.equal(can([a, b], "product.listing.create", { providerId: "shopA" }), true)
    assert.equal(can([a, b], "product.listing.create", { providerId: "shopB" }), false)
    assert.equal(can([a, b], "product.listing.view", { providerId: "shopB" }), true)
})

test("no privilege escalation: ungrantable lists the keys the actor does not hold", () => {
    const manager = effective([assign("MANAGER")], { providerId: "shopA" })
    assert.deepEqual(ungrantable(manager, ["product.price.edit", "team.member.transfer_ownership"]), ["team.member.transfer_ownership"])
    const owner = effective([assign("OWNER")], { providerId: "shopA" })
    assert.deepEqual(ungrantable(owner, ALL_SHOP_KEYS), [])
})

test("listAllowed returns what a role can do", () => {
    const eff = effective([assign("VIEWER")], { providerId: "shopA" })
    const allowed = listAllowed(eff, ALL_SHOP_KEYS)
    assert.ok(allowed.includes("product.listing.view"))
    assert.ok(!allowed.includes("product.listing.edit"))
    assert.equal(has(eff, "product.listing.view"), true)
})
