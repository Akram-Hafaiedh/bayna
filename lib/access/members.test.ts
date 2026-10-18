// lib/access/members.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { membersWithPermission, type MemberAssignment } from "./members"

const NOW = new Date("2026-10-17T12:00:00Z")

function shopRole(userId: string, providerId: string, permissions: string[], extra: Partial<MemberAssignment> = {}): MemberAssignment {
    return {
        userId,
        scope: "SHOP",
        providerId,
        status: "ACTIVE",
        expiresAt: null,
        grants: [],
        denies: [],
        role: { key: "X", permissions },
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

test("a grant adds the permission and a deny removes it", () => {
    const rows = [
        shopRole("granted", "s1", [], { grants: ["product.price.edit"] }),
        shopRole("denied", "s1", ["product.price.edit"], { denies: ["product.price.edit"] }),
    ]
    assert.deepEqual(membersWithPermission(rows, "s1", "product.price.edit", NOW), ["granted"])
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
