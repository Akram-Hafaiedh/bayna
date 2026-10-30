// tests/unit/access/role-rules.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { OWNERSHIP_KEY } from "@/lib/access/catalogue"
import { checkRoleChange, checkRoleDelete, checkRoleEditKeepsOwner, parseRoleInput, roleInUseMessage } from "@/lib/access/role-rules"
import { actionTitle, describeKey, moduleTitle } from "@/lib/access/permission-labels"

const good = { name: "  Night   shift ", description: " Works the evenings ", permissions: ["order.request.view_all", "order.request.accept", "order.request.accept"] }

test("a role needs a name, a description is optional, keys are checked and sorted", () => {
    const r = parseRoleInput(good, "SHOP")
    assert.deepEqual(r, { ok: true, value: { name: "Night shift", description: "Works the evenings", permissions: ["order.request.accept", "order.request.view_all"] } })
    assert.equal(parseRoleInput({ ...good, name: "x" }, "SHOP").ok, false)
    assert.equal(parseRoleInput({ ...good, name: "x".repeat(61) }, "SHOP").ok, false)
    assert.equal(parseRoleInput({ ...good, description: "x".repeat(201) }, "SHOP").ok, false)
    const blank = parseRoleInput({ ...good, description: "  " }, "SHOP")
    assert.deepEqual(blank.ok && blank.value.description, null)
    assert.equal(parseRoleInput(null, "SHOP").ok, false)
})

test("unknown keys are refused; business keys are only for business roles", () => {
    assert.equal(parseRoleInput({ ...good, permissions: ["nope.nope.nope"] }, "SHOP").ok, false)
    assert.equal(parseRoleInput({ ...good, permissions: ["business.team.invite"] }, "SHOP").ok, false)
    assert.equal(parseRoleInput({ ...good, permissions: ["business.team.invite"] }, "BUSINESS").ok, true)
    assert.equal(parseRoleInput({ ...good, permissions: ["user.account.view"] }, "BUSINESS").ok, false)
    assert.equal(parseRoleInput({ ...good, permissions: [] }, "SHOP").ok, false)
    assert.equal(parseRoleInput({ ...good, permissions: "all" }, "SHOP").ok, false)
})

test('"*" is the only key when present', () => {
    const r = parseRoleInput({ ...good, permissions: ["order.request.view_all", "*"] }, "SHOP")
    assert.deepEqual(r.ok && r.value.permissions, ["*"])
})

test("nobody gives a role keys they do not hold, whatever the role is called", () => {
    const can = (k: string) => ["order.request.view_all", "order.request.accept"].includes(k)
    assert.equal(checkRoleChange({ can, existing: null, next: ["order.request.accept"] }).ok, true)
    assert.equal(checkRoleChange({ can, existing: null, next: ["order.request.refund"] }).ok, false)
    assert.equal(checkRoleChange({ can, existing: null, next: ["*"] }).ok, false)
})

test("editing keeps the keys the role already had, only new ones must be held", () => {
    const can = (k: string) => k === "a.b.c"
    assert.equal(checkRoleChange({ can, existing: ["a.b.c"], next: ["a.b.c"] }).ok, true)
    assert.equal(checkRoleChange({ can, existing: ["a.b.c"], next: ["a.b.c", "x.y.z"] }).ok, false)
})

test("nobody edits or deletes a role that holds keys above them", () => {
    const can = (k: string) => k === "a.b.c"
    assert.equal(checkRoleChange({ can, existing: ["a.b.c", "x.y.z"], next: ["a.b.c"] }).ok, false)
    assert.equal(checkRoleDelete({ can, permissions: ["a.b.c", "x.y.z"] }).ok, false)
    assert.equal(checkRoleDelete({ can, permissions: ["a.b.c"] }).ok, true)
    assert.equal(checkRoleDelete({ can, permissions: ["*"] }).ok, false)
    assert.equal(checkRoleDelete({ can: () => true, permissions: ["*"] }).ok, true)
})

test("a role in use cannot be deleted, and the message says why", () => {
    assert.equal(roleInUseMessage({ members: 0, invites: 0 }), null)
    assert.match(roleInUseMessage({ members: 2, invites: 0 })!, /2 people have this role/)
    assert.match(roleInUseMessage({ members: 1, invites: 3 })!, /1 person has this role and 3 invitations use it/)
    assert.match(roleInUseMessage({ members: 1, invites: 0 })!, /Team page/)
})

const KEY = OWNERSHIP_KEY.SHOP
test("editing the only owner role so it loses the ownership key is refused", () => {
    const members = [
        { roleId: "r1", permissions: [KEY, "a.b.c"], live: true },
        { roleId: "r2", permissions: ["a.b.c"], live: true },
    ]
    assert.equal(checkRoleEditKeepsOwner(members, "r1", ["a.b.c"], KEY).ok, false)
    assert.equal(checkRoleEditKeepsOwner(members, "r1", [KEY], KEY).ok, true)
    assert.equal(checkRoleEditKeepsOwner(members, "r1", ["*"], KEY).ok, true)
    assert.equal(checkRoleEditKeepsOwner(members, "r2", ["z.z.z"], KEY).ok, true)
})

test("another live owner makes the edit safe; a suspended owner does not count", () => {
    const two = [
        { roleId: "r1", permissions: [KEY], live: true },
        { roleId: "r3", permissions: ["*"], live: true },
    ]
    assert.equal(checkRoleEditKeepsOwner(two, "r1", ["a.b.c"], KEY).ok, true)
    const suspended = [
        { roleId: "r1", permissions: [KEY], live: true },
        { roleId: "r3", permissions: ["*"], live: false },
    ]
    assert.equal(checkRoleEditKeepsOwner(suspended, "r1", ["a.b.c"], KEY).ok, false)
})

test("a level that already has no owner is not blocked by this rule", () => {
    assert.equal(checkRoleEditKeepsOwner([{ roleId: "r2", permissions: ["a.b.c"], live: true }], "r2", ["x.y.z"], KEY).ok, true)
})

test("labels read as plain words", () => {
    assert.equal(moduleTitle("product"), "Products")
    assert.equal(moduleTitle("some_new_module"), "Some new module")
    assert.equal(actionTitle("view_all"), "View all")
    assert.equal(actionTitle("odd_action"), "Odd action")
    assert.equal(describeKey("product.price.edit"), "Edit, price (Products)")
    assert.match(describeKey("*"), /Everything/)
})
