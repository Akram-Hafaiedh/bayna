// lib/access/business.test.ts
// Run: npm run test:unit
// The business level: a business-level role reaches every shop of its business and nothing else.
import { test } from "vitest"
import assert from "node:assert/strict"
import { ALL_BUSINESS_KEYS, ALL_SHOP_KEYS, isKnownKey } from "./catalogue"
import { ROLE_TEMPLATES, validateTemplates } from "./role-templates"
import { can, roleNames, type AssignmentInput } from "./evaluate"
import { reachableBusinessIds, reachableShopIds } from "./reach"

const role = (scope: "BUSINESS" | "SHOP", id: string) => {
    const r = ROLE_TEMPLATES.find((x) => x.scope === scope && x.id === id)
    if (!r) throw new Error(`role ${scope}:${id} is not defined`)
    return r
}

const business = (roleId: string, businessId: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => ({
    scope: "BUSINESS",
    shopId: null,
    businessId,
    status: "ACTIVE",
    expiresAt: null,
    role: { name: role("BUSINESS", roleId).name, permissions: role("BUSINESS", roleId).permissions },
    ...extra,
})

const shop = (roleId: string, shopId: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => ({
    scope: "SHOP",
    shopId,
    businessId: null,
    status: "ACTIVE",
    expiresAt: null,
    role: { name: role("SHOP", roleId).name, permissions: role("SHOP", roleId).permissions },
    ...extra,
})

const NOW = new Date("2026-10-18T12:00:00Z")

test("business roles are valid; the owner holds everything, HR holds business and shop team keys", () => {
    assert.deepEqual(validateTemplates(), [])
    assert.deepEqual(role("BUSINESS", "OWNER").permissions, ["*"])
    const hr = role("BUSINESS", "HR").permissions
    assert.ok(hr.includes("business.team.invite"))
    assert.ok(hr.includes("team.member.invite")) // reaches the teams of every shop
    assert.ok(hr.every((k) => ALL_BUSINESS_KEYS.includes(k)))
    assert.equal(isKnownKey("BUSINESS", "business.team.invite"), true)
    assert.equal(isKnownKey("SHOP", "business.team.invite"), false)
    assert.equal(isKnownKey("BUSINESS", "*"), true)
})

test("business keys never leak into shop roles", () => {
    for (const r of ROLE_TEMPLATES.filter((x) => x.scope === "SHOP")) {
        assert.ok(!r.permissions.some((k) => k.startsWith("business.")), r.id)
    }
    assert.ok(!ALL_SHOP_KEYS.some((k) => k.startsWith("business.")))
})

test("a business owner holds shop permissions in every shop of the business", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { shopId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can(list, "product.price.edit", { shopId: "s2", businessId: "b1" }, NOW), true)
})

test("it does not reach a shop of another business", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { shopId: "s9", businessId: "b2" }, NOW), false)
})

test("inheritance needs the shop's business in the context (default deny otherwise)", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { shopId: "s1" }, NOW), false)
})

test("business-only checks use only that business's assignments", () => {
    const list = [business("OWNER", "b1"), shop("OWNER", "s1")]
    assert.equal(can(list, "business.profile.edit_legal", { businessId: "b1" }, NOW), true)
    assert.equal(can(list, "business.profile.edit_legal", { businessId: "b2" }, NOW), false)
    // a shop owner is not a business owner
    assert.equal(can([shop("OWNER", "s1")], "business.profile.edit", { businessId: "b1" }, NOW), false)
})

test("a business accountant can read the business but not edit it or change prices", () => {
    const list = [business("ACCOUNTANT", "b1")]
    assert.equal(can(list, "business.profile.view", { businessId: "b1" }, NOW), true)
    assert.equal(can(list, "business.profile.edit", { businessId: "b1" }, NOW), false)
    assert.equal(can(list, "insight.dashboard.view", { shopId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can(list, "product.price.edit", { shopId: "s1", businessId: "b1" }, NOW), false)
})

test("shop-level and business-level assignments add up inside the shop", () => {
    const list = [business("ACCOUNTANT", "b1"), shop("INVENTORY_CLERK", "s1")]
    const ctx = { shopId: "s1", businessId: "b1" }
    assert.equal(can(list, "insight.dashboard.view", ctx, NOW), true) // from the business
    assert.equal(can(list, "product.stock.edit", ctx, NOW), true) // from the shop
    assert.equal(can(list, "product.stock.edit", { shopId: "s2", businessId: "b1" }, NOW), false)
})

test("an HR role at business level reaches the teams of every shop but not their products", () => {
    const list = [business("HR", "b1")]
    for (const shopId of ["s1", "s2"]) {
        const ctx = { shopId: shopId, businessId: "b1" }
        assert.equal(can(list, "team.member.invite", ctx, NOW), true)
        assert.equal(can(list, "product.price.edit", ctx, NOW), false)
        assert.equal(can(list, "team.member.transfer_ownership", ctx, NOW), false)
    }
    assert.equal(can(list, "business.team.invite", { businessId: "b1" }, NOW), true)
})

test("an HR role in one shop (a shop role) reaches that shop only, not the business", () => {
    const list = [shop("HR", "s1")]
    assert.equal(can(list, "team.member.invite", { shopId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can(list, "team.member.invite", { shopId: "s2", businessId: "b1" }, NOW), false)
    assert.equal(can(list, "business.team.view", { businessId: "b1" }, NOW), false)
})

test("a business role given for one shop of the business works there only", () => {
    // the assignment targets shop s1, the role is a business-owned one (here: Operations)
    const ops = role("BUSINESS", "OPERATIONS")
    const a: AssignmentInput = { scope: "SHOP", shopId: "s1", businessId: null, status: "ACTIVE", expiresAt: null, role: { name: ops.name, permissions: ops.permissions } }
    assert.equal(can([a], "product.price.edit", { shopId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can([a], "product.price.edit", { shopId: "s2", businessId: "b1" }, NOW), false)
    assert.equal(can([a], "business.profile.view", { businessId: "b1" }, NOW), false)
})

test("suspended or expired business assignments grant nothing", () => {
    const ctx = { shopId: "s1", businessId: "b1" }
    assert.equal(can([business("OWNER", "b1", { status: "SUSPENDED" })], "product.price.edit", ctx, NOW), false)
    assert.equal(can([business("OWNER", "b1", { expiresAt: new Date("2026-10-01T00:00:00Z") })], "product.price.edit", ctx, NOW), false)
})

test("roleNames labels the actor with the roles that apply in the shop", () => {
    const list = [business("OWNER", "b1"), shop("MANAGER", "s1"), business("OWNER", "b2")]
    assert.deepEqual(roleNames(list, { shopId: "s1", businessId: "b1" }, NOW), ["Business owner", "Manager"])
})

test("reachableShopIds: own shops plus every shop of each business owned", () => {
    const list = [business("OWNER", "b1"), shop("MANAGER", "s7")]
    const byBusiness = { b1: ["s2", "s1"], b2: ["s5"] }
    assert.deepEqual(reachableShopIds(list, byBusiness, NOW), ["s1", "s2", "s7"])
})

test("reachableShopIds ignores inactive assignments and unknown businesses", () => {
    const list = [business("OWNER", "b1", { status: "SUSPENDED" }), business("OWNER", "bX"), shop("MANAGER", "s7", { status: "INVITED" })]
    assert.deepEqual(reachableShopIds(list, { b1: ["s1"] }, NOW), [])
})

test("reachableBusinessIds lists live business-level assignments", () => {
    const list = [business("OWNER", "b2"), business("ACCOUNTANT", "b1"), business("OWNER", "b3", { status: "SUSPENDED" }), shop("OWNER", "s1")]
    assert.deepEqual(reachableBusinessIds(list, NOW), ["b1", "b2"])
})
