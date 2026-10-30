// tests/unit/access/access.test.ts
// Run: npm run test:unit   (Vitest)
import { test } from "vitest"
import assert from "node:assert/strict"
import {
    ALL_CLIENT_KEYS,
    ALL_PLATFORM_KEYS,
    ALL_SHOP_KEYS,
    OWNERSHIP_KEY,
    holdsKey,
    isKnownKey,
} from "@/lib/access/catalogue"
import { expandPatterns, matchesPattern } from "@/lib/access/match"
import { ROLE_TEMPLATES, validateTemplates } from "@/lib/access/role-templates"
import { AssignmentInput, can, effective, has, listAllowed, ungrantable } from "@/lib/access/evaluate"

// Test roles come from the default templates; ids are the template ids ("OWNER" is the shop owner here)
const role = (id: string) => {
    const r = ROLE_TEMPLATES.find((x) => x.id === id && (x.scope !== "BUSINESS" || id !== "OWNER"))
    if (!r) throw new Error(`role ${id} is not defined`)
    return r
}

const assign = (roleId: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => {
    const r = role(roleId)
    return {
        scope: r.scope,
        shopId: r.scope === "SHOP" ? "shopA" : null,
        status: "ACTIVE",
        expiresAt: null,
        role: { name: r.name, permissions: r.permissions },
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

test("isKnownKey accepts * for any role: it is an ordinary choice, bounded by what the giver holds", () => {
    assert.equal(isKnownKey("PLATFORM", "*"), true)
    assert.equal(isKnownKey("SHOP", "*"), true)
    assert.equal(isKnownKey("BUSINESS", "*"), true)
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

// ---- default role templates ---------------------------------------------------------------------

test("role templates are valid", () => {
    assert.deepEqual(validateTemplates(), [])
})

test('"everything" roles store "*" so they keep covering permissions added later; the rest store explicit keys', () => {
    const everything = ROLE_TEMPLATES.filter((r) => r.permissions.includes("*")).map((r) => `${r.scope}:${r.id}`).sort()
    assert.deepEqual(everything, ["BUSINESS:OWNER", "PLATFORM:SUPER_ADMIN", "SHOP:OWNER"])
    for (const r of ROLE_TEMPLATES) {
        if (!r.permissions.includes("*")) assert.ok(r.permissions.length > 0, r.id)
    }
})

test("every level has a default role that can own it", () => {
    for (const [scope, key] of [["BUSINESS", OWNERSHIP_KEY.BUSINESS], ["SHOP", OWNERSHIP_KEY.SHOP]] as const) {
        const owners = ROLE_TEMPLATES.filter((r) => r.scope === scope && holdsKey(r.permissions, key))
        assert.ok(owners.length >= 1, scope)
    }
})

test("HR roles manage people but cannot transfer ownership; shop HR has no product access", () => {
    const shopHr = ROLE_TEMPLATES.find((r) => r.scope === "SHOP" && r.id === "HR")!.permissions
    assert.ok(shopHr.includes("team.member.invite"))
    assert.ok(!shopHr.includes("team.member.transfer_ownership"))
    assert.ok(!shopHr.some((k) => k.startsWith("product.")))
    const bizHr = ROLE_TEMPLATES.find((r) => r.scope === "BUSINESS" && r.id === "HR")!.permissions
    assert.ok(bizHr.includes("business.team.invite"))
    assert.ok(!bizHr.includes("business.team.transfer_ownership"))
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
    const holders = ROLE_TEMPLATES.filter((r) => r.scope === "SHOP" && (r.permissions.includes("product.price.edit") || r.permissions.includes("*")))
    assert.deepEqual(holders.map((r) => r.id).sort(), ["MANAGER", "OWNER"])
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
    assert.equal(can([], "product.listing.view", { shopId: "shopA" }), false)
})

test("platform check uses platform assignments only; shop check uses that shop only", () => {
    const owner = assign("OWNER")
    const admin = assign("ADMIN")
    assert.equal(can([owner], "product.listing.create"), false, "shop role does not apply to a platform check")
    assert.equal(can([owner], "product.listing.create", { shopId: "shopA" }), true)
    assert.equal(can([owner], "product.listing.create", { shopId: "shopB" }), false, "other shop")
    assert.equal(can([admin], "catalog.item.view", { shopId: "shopA" }), false, "platform role does not apply inside a shop")
    assert.equal(can([admin], "catalog.item.view"), true)
})

test("the same key means different things in shop and platform scope", () => {
    const handler = assign("ORDER_HANDLER")
    assert.equal(can([handler], "order.request.view_all", { shopId: "shopA" }), true)
    assert.equal(can([handler], "order.request.view_all"), false)
})

test("SUPER_ADMIN can do anything on the platform, but not inside a shop it has no assignment for", () => {
    const sa = assign("SUPER_ADMIN")
    assert.equal(can([sa], "anything.at.all"), true)
    assert.equal(can([sa], "product.listing.create", { shopId: "shopA" }), false)
})

test("access is the union of the person's roles: two roles add up, nothing is taken away", () => {
    const clerk = assign("INVENTORY_CLERK")
    assert.equal(can([clerk], "product.price.edit", { shopId: "shopA" }), false)
    const both = [clerk, assign("MANAGER")]
    assert.equal(can(both, "product.price.edit", { shopId: "shopA" }), true, "the manager role adds price editing")
    assert.equal(can(both, "product.listing.create", { shopId: "shopA" }), true)
})

test("a wildcard role holds everything at its own level and nothing outside it", () => {
    const owner = assign("OWNER")
    assert.equal(can([owner], "anything.at.all", { shopId: "shopA" }), true)
    assert.equal(can([owner], "anything.at.all", { shopId: "shopB" }), false)
    assert.equal(can([owner], "anything.at.all"), false)
})

test("every role is evaluated the same way: a custom role is just a name and keys", () => {
    const custom: AssignmentInput = {
        scope: "SHOP", shopId: "shopA", status: "ACTIVE", expiresAt: null,
        role: { name: "Night shift", permissions: ["order.request.view_all", "order.request.update_status"] },
    }
    assert.equal(can([custom], "order.request.update_status", { shopId: "shopA" }), true)
    assert.equal(can([custom], "order.request.refund", { shopId: "shopA" }), false)
})

test("suspended, invited and expired assignments grant nothing", () => {
    const now = new Date("2026-10-15T12:00:00Z")
    const key = "product.listing.view"
    const ctx = { shopId: "shopA" }
    assert.equal(can([assign("VIEWER", { status: "SUSPENDED" })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { status: "INVITED" })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { expiresAt: new Date("2026-10-15T11:59:59Z") })], key, ctx, now), false)
    assert.equal(can([assign("VIEWER", { expiresAt: new Date("2026-10-15T12:00:01Z") })], key, ctx, now), true)
})

test("a person with two shops gets each shop's own permissions", () => {
    const a = assign("OWNER", { shopId: "shopA" })
    const b = assign("VIEWER", { shopId: "shopB" })
    assert.equal(can([a, b], "product.listing.create", { shopId: "shopA" }), true)
    assert.equal(can([a, b], "product.listing.create", { shopId: "shopB" }), false)
    assert.equal(can([a, b], "product.listing.view", { shopId: "shopB" }), true)
})

test("handing out the wildcard needs the wildcard", () => {
    const manager = effective([assign("MANAGER")], { shopId: "shopA" })
    assert.deepEqual(ungrantable(manager, ["*"]), ["*"])
    assert.deepEqual(ungrantable(effective([assign("OWNER")], { shopId: "shopA" }), ["*"]), [])
})

test("no privilege escalation: ungrantable lists the keys the actor does not hold", () => {
    const manager = effective([assign("MANAGER")], { shopId: "shopA" })
    assert.deepEqual(ungrantable(manager, ["product.price.edit", "team.member.transfer_ownership"]), ["team.member.transfer_ownership"])
    const owner = effective([assign("OWNER")], { shopId: "shopA" })
    assert.deepEqual(ungrantable(owner, ALL_SHOP_KEYS), [])
})

test("listAllowed returns what a role can do", () => {
    const eff = effective([assign("VIEWER")], { shopId: "shopA" })
    const allowed = listAllowed(eff, ALL_SHOP_KEYS)
    assert.ok(allowed.includes("product.listing.view"))
    assert.ok(!allowed.includes("product.listing.edit"))
    assert.equal(has(eff, "product.listing.view"), true)
})
