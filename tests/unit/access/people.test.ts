// lib/access/people.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { groupPeople, type PersonRow } from "@/lib/access/people"

const row = (over: Partial<PersonRow>): PersonRow => ({
    userId: "u1", name: "Sami", email: "sami@x.tn", roleName: "Manager", shop: null, suspended: false, accountClosed: false, ...over,
})

test("one line per person, with the business role and every shop role", () => {
    const people = groupPeople([
        row({ userId: "o", name: "Owner", roleName: "Business owner" }),
        row({ userId: "s", name: "Sami", roleName: "Manager", shop: { id: "s1", name: "Sfax" } }),
        row({ userId: "s", name: "Sami", roleName: "Viewer", shop: { id: "t1", name: "Tunis" } }),
    ])
    assert.equal(people.length, 2)
    assert.equal(people[0].userId, "o")
    assert.equal(people[0].businessRole, "Business owner")
    assert.deepEqual(people[1].shopRoles.map((r) => `${r.shopName}:${r.roleName}`), ["Sfax:Manager", "Tunis:Viewer"])
    assert.equal(people[1].businessRole, null)
})

test("someone with both a business and a shop role is one person", () => {
    const people = groupPeople([
        row({ roleName: "Business accountant" }),
        row({ roleName: "Viewer", shop: { id: "s1", name: "Sfax" } }),
    ])
    assert.equal(people.length, 1)
    assert.equal(people[0].businessRole, "Business accountant")
    assert.equal(people[0].shopRoles.length, 1)
})

test("people with a business role come first, then by name", () => {
    const people = groupPeople([
        row({ userId: "a", name: "Zied", shop: { id: "s1", name: "Sfax" } }),
        row({ userId: "b", name: "Amal", shop: { id: "s1", name: "Sfax" } }),
        row({ userId: "c", name: "Yassine", roleName: "Business owner" }),
    ])
    assert.deepEqual(people.map((p) => p.userId), ["c", "b", "a"])
})

test("suspension is kept per role", () => {
    const [p] = groupPeople([
        row({ roleName: "Business accountant", suspended: true }),
        row({ roleName: "Viewer", shop: { id: "s1", name: "Sfax" } }),
    ])
    assert.equal(p.suspendedInBusiness, true)
    assert.equal(p.shopRoles[0].suspended, false)
})

test("no rows, no people", () => {
    assert.deepEqual(groupPeople([]), [])
})
