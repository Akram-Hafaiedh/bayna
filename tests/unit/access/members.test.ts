// tests/unit/access/members.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { membersWithPermission, type MemberAssignment } from "@/lib/access/members"

const NOW = new Date("2026-10-17T12:00:00Z")

function shopRole(userId: string, shopId: string, permissions: string[], extra: Partial<MemberAssignment> = {}): MemberAssignment {
    return {
        userId,
        scope: "SHOP",
        shopId,
        status: "ACTIVE",
        expiresAt: null,
        role: { name: "X", permissions },
        ...extra,
    }
}

test("only people who hold the permission in that shop are returned", () => {
    const rows = [
        shopRole("owner", "s1", ["product.price.edit", "product.stock.edit"]),
        shopRole("clerk", "s1", ["product.stock.edit"]),
        shopRole("other", "s2", ["product.price.edit"]),
    ]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), ["owner"])
    assert.deepEqual(membersWithPermission(rows, "s2", "product.price.edit", NOW), ["other"])
})

test("a wildcard role counts, and a role without the key does not", () => {
    const rows = [shopRole("owner", "s1", ["*"]), shopRole("viewer", "s1", ["product.listing.view"])]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), ["owner"])
})

test("suspended and expired assignments do not count", () => {
    const rows = [
        shopRole("suspended", "s1", ["product.price.edit"], { status: "SUSPENDED" }),
        shopRole("expired", "s1", ["product.price.edit"], { expiresAt: new Date("2026-10-01T00:00:00Z") }),
        shopRole("live", "s1", ["product.price.edit"], { expiresAt: new Date("2026-12-01T00:00:00Z") }),
    ]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), ["live"])
})

test("a person with two assignments in one shop is listed once", () => {
    const rows = [shopRole("a", "s1", ["product.price.edit"]), shopRole("a", "s1", ["product.stock.edit"])]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), ["a"])
})

function businessRole(userId: string, businessId: string, permissions: string[], extra: Partial<MemberAssignment> = {}): MemberAssignment {
    return {
        userId,
        scope: "BUSINESS",
        shopId: null,
        businessId,
        status: "ACTIVE",
        expiresAt: null,
        role: { name: "X", permissions },
        ...extra,
    }
}

test("a business-level member counts in every shop of the business, and only there", () => {
    const rows = [
        businessRole("bizOwner", "b1", ["product.price.edit"]),
        shopRole("clerk", "s1", ["product.stock.edit"]),
        businessRole("elsewhere", "b2", ["product.price.edit"]),
    ]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW, "b1"), ["bizOwner"])
    assert.deepEqual(membersWithPermission(rows, "s2", "product.price.edit", NOW, "b1"), ["bizOwner"])
    assert.deepEqual(membersWithPermission(rows, "s3", "product.price.edit", NOW, "b2"), ["elsewhere"])
})

test("without the shop's business, business-level members are not counted", () => {
    const rows = [businessRole("bizOwner", "b1", ["product.price.edit"])]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), [])
})
