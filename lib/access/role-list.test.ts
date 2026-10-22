// lib/access/role-list.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { NO_FILTERS, accessLabel, filterRoles, isFiltered, roleModules, type RoleListItem } from "./role-list"
import { NO_MEMBER_FILTERS, filterMembers, initials } from "./team-filter"

const shop = { scope: "SHOP" as const, id: "s1", name: "Tunis shop" }
const biz = { scope: "BUSINESS" as const, id: "b1", name: "Carthage Group" }
const role = (over: Partial<RoleListItem>): RoleListItem => ({
    id: "r", name: "Role", description: null, permissions: [], members: 0, invites: 0, editable: true, owner: shop, ...over,
})
const ROLES: RoleListItem[] = [
    role({ id: "1", name: "Manager", description: "Runs the shop", permissions: ["product.catalogue.view", "order.request.view_all"], members: 2 }),
    role({ id: "2", name: "Owner", permissions: ["*"], members: 1 }),
    role({ id: "3", name: "Viewer", permissions: ["product.catalogue.view"], invites: 1 }),
    role({ id: "4", name: "Accountant", permissions: ["billing.invoice.view"], owner: biz }),
    role({ id: "5", name: "Spare", permissions: ["order.request.view_all", "order.request.update_status", "inventory.stock.view"] }),
]
const ids = (r: RoleListItem[]) => r.map((x) => x.id)

test("no filters lists everything by name", () => {
    assert.deepEqual(ids(filterRoles(ROLES, NO_FILTERS)), ["4", "1", "2", "5", "3"])
    assert.equal(isFiltered(NO_FILTERS), false)
})

test("search matches name, description, owner and module names, every word", () => {
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, q: "runs" })), ["1"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, q: "carthage" })), ["4"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, q: "orders" })), ["1", "5"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, q: "orders inventory" })), ["5"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, q: "everything" })), ["2"])
})

test("filters by owner, access level and use", () => {
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, owner: "b1" })), ["4"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, access: "everything" })), ["2"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, access: "limited" })).includes("2"), false)
    // a waiting invitation counts as use: the role cannot be deleted either
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, usage: "used" })), ["1", "2", "3"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, usage: "unused" })), ["4", "5"])
    assert.equal(isFiltered({ ...NO_FILTERS, usage: "used" }), true)
})

test("sorts by people and by how much access", () => {
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, sort: "people" })).slice(0, 2), ["1", "2"])
    assert.deepEqual(ids(filterRoles(ROLES, { ...NO_FILTERS, sort: "access" })).slice(0, 3), ["2", "5", "1"])
})

test("describes a role in plain words", () => {
    assert.equal(accessLabel(["*"]), "Everything")
    assert.equal(accessLabel([]), "No permissions")
    assert.equal(accessLabel(["product.catalogue.view"]), "1 module, 1 permission")
    assert.equal(accessLabel(["product.catalogue.view", "order.request.view_all", "order.request.update_status"]), "2 modules, 3 permissions")
    assert.deepEqual(roleModules(["order.request.view_all", "product.catalogue.view"]), ["Orders", "Products"])
})

const people = [
    { name: "Amel Ben Salah", email: "amel@x.tn", roleId: "r1", roleName: "Manager", status: "ACTIVE" as const, accountClosed: false },
    { name: null, email: "karim@x.tn", roleId: "r2", roleName: "Viewer", status: "SUSPENDED" as const, accountClosed: false },
    { name: "Sana", email: "sana@x.tn", roleId: "r2", roleName: "Viewer", status: "ACTIVE" as const, accountClosed: true },
]

test("team filter: search, role and status", () => {
    const emails = (l: typeof people) => l.map((p) => p.email)
    assert.equal(filterMembers(people, NO_MEMBER_FILTERS).length, 3)
    assert.deepEqual(emails(filterMembers(people, { ...NO_MEMBER_FILTERS, q: "ben salah" })), ["amel@x.tn"])
    assert.deepEqual(emails(filterMembers(people, { ...NO_MEMBER_FILTERS, q: "viewer" })), ["karim@x.tn", "sana@x.tn"])
    assert.deepEqual(emails(filterMembers(people, { ...NO_MEMBER_FILTERS, roleId: "r1" })), ["amel@x.tn"])
    assert.deepEqual(emails(filterMembers(people, { ...NO_MEMBER_FILTERS, status: "suspended" })), ["karim@x.tn"])
    // a closed account is not "active"
    assert.deepEqual(emails(filterMembers(people, { ...NO_MEMBER_FILTERS, status: "active" })), ["amel@x.tn"])
})

test("avatar initials", () => {
    assert.equal(initials("Amel Ben Salah", "a@x.tn"), "AS")
    assert.equal(initials("sana", "s@x.tn"), "S")
    assert.equal(initials(null, "karim@x.tn"), "K")
    assert.equal(initials("  ", ""), "?")
})
