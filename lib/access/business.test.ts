// lib/access/business.test.ts
// Run: npm run test:unit
// The business level: a business-level role reaches every shop of its business and nothing else.
import { test } from "vitest"
import assert from "node:assert/strict"
import { ALL_BUSINESS_KEYS, ALL_SHOP_KEYS, isKnownKey } from "./catalogue"
import { SYSTEM_ROLES, validateSystemRoles } from "./roles"
import { can, roleKeys, type AssignmentInput } from "./evaluate"
import { reachableBusinessIds, reachableShopIds } from "./reach"

const role = (scope: "BUSINESS" | "SHOP", key: string) => {
    const r = SYSTEM_ROLES.find((x) => x.scope === scope && x.key === key)
    if (!r) throw new Error(`role ${scope}:${key} is not defined`)
    return r
}

const business = (roleKey: string, businessId: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => ({
    scope: "BUSINESS",
    providerId: null,
    businessId,
    status: "ACTIVE",
    expiresAt: null,
    grants: [],
    denies: [],
    role: { key: roleKey, permissions: role("BUSINESS", roleKey).permissions },
    ...extra,
})

const shop = (roleKey: string, providerId: string, extra: Partial<AssignmentInput> = {}): AssignmentInput => ({
    scope: "SHOP",
    providerId,
    businessId: null,
    status: "ACTIVE",
    expiresAt: null,
    grants: [],
    denies: [],
    role: { key: roleKey, permissions: role("SHOP", roleKey).permissions },
    ...extra,
})

const NOW = new Date("2026-10-18T12:00:00Z")

test("business roles are valid and hold business keys plus shop keys", () => {
    assert.deepEqual(validateSystemRoles(), [])
    const owner = role("BUSINESS", "OWNER").permissions
    assert.ok(owner.includes("business.profile.edit_legal"))
    assert.ok(owner.includes("product.price.edit"))
    assert.equal(owner.length, ALL_BUSINESS_KEYS.length)
    assert.equal(isKnownKey("BUSINESS", "business.team.invite"), true)
    assert.equal(isKnownKey("SHOP", "business.team.invite"), false)
    assert.equal(isKnownKey("BUSINESS", "*"), false)
})

test("business keys never leak into shop roles", () => {
    for (const r of SYSTEM_ROLES.filter((x) => x.scope === "SHOP")) {
        assert.ok(!r.permissions.some((k) => k.startsWith("business.")), r.key)
    }
    assert.ok(!ALL_SHOP_KEYS.some((k) => k.startsWith("business.")))
})

test("a business owner holds shop permissions in every shop of the business", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { providerId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can(list, "product.price.edit", { providerId: "s2", businessId: "b1" }, NOW), true)
})

test("it does not reach a shop of another business", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { providerId: "s9", businessId: "b2" }, NOW), false)
})

test("inheritance needs the shop's business in the context (default deny otherwise)", () => {
    const list = [business("OWNER", "b1")]
    assert.equal(can(list, "product.price.edit", { providerId: "s1" }, NOW), false)
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
    assert.equal(can(list, "insight.dashboard.view", { providerId: "s1", businessId: "b1" }, NOW), true)
    assert.equal(can(list, "product.price.edit", { providerId: "s1", businessId: "b1" }, NOW), false)
})

test("shop-level and business-level assignments add up inside the shop", () => {
    const list = [business("ACCOUNTANT", "b1"), shop("INVENTORY_CLERK", "s1")]
    const ctx = { providerId: "s1", businessId: "b1" }
    assert.equal(can(list, "insight.dashboard.view", ctx, NOW), true) // from the business
    assert.equal(can(list, "product.stock.edit", ctx, NOW), true) // from the shop
    assert.equal(can(list, "product.stock.edit", { providerId: "s2", businessId: "b1" }, NOW), false)
})

test("a deny on a business assignment applies inside its shops", () => {
    const list = [business("OWNER", "b1", { denies: ["product.price.edit"] })]
    assert.equal(can(list, "product.price.edit", { providerId: "s1", businessId: "b1" }, NOW), false)
    assert.equal(can(list, "product.stock.edit", { providerId: "s1", businessId: "b1" }, NOW), true)
})

test("suspended or expired business assignments grant nothing", () => {
    const ctx = { providerId: "s1", businessId: "b1" }
    assert.equal(can([business("OWNER", "b1", { status: "SUSPENDED" })], "product.price.edit", ctx, NOW), false)
    assert.equal(can([business("OWNER", "b1", { expiresAt: new Date("2026-10-01T00:00:00Z") })], "product.price.edit", ctx, NOW), false)
})

test("roleKeys labels the actor with the roles that apply in the shop", () => {
    const list = [business("OWNER", "b1"), shop("MANAGER", "s1"), business("OWNER", "b2")]
    assert.deepEqual(roleKeys(list, { providerId: "s1", businessId: "b1" }, NOW), ["MANAGER", "OWNER"])
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
