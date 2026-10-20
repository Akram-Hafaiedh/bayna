// lib/access/owners.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { OWNERSHIP_KEY } from "./catalogue"
import { checkOwnerRule, type LevelMember } from "./owners"

// There is no special Owner role: an owner is anyone whose role holds the ownership key
const KEY = OWNERSHIP_KEY.SHOP
const owner = (id: string, live = true): LevelMember => ({ id, holdsOwnership: true, live })
const staff = (id: string, live = true): LevelMember => ({ id, holdsOwnership: false, live })
const MANAGER = ["product.listing.edit"]
const OWNER_ROLE = [KEY]

test("the only owner cannot be removed, suspended or given another role", () => {
    const members = [owner("a"), staff("b")]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }, KEY).ok, false)
    assert.equal(checkOwnerRule(members, { type: "suspend", assignmentId: "a" }, KEY).ok, false)
    assert.equal(checkOwnerRule(members, { type: "set_role", assignmentId: "a", newPermissions: MANAGER }, KEY).ok, false)
})

test("the error tells the person what to do", () => {
    const r = checkOwnerRule([owner("a")], { type: "remove", assignmentId: "a" }, KEY)
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.error, /transfer ownership/)
})

test("one of two owners may go", () => {
    const members = [owner("a"), owner("b")]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }, KEY).ok, true)
})

test("an owner whose assignment or account is not live does not count as the other owner", () => {
    const members = [owner("a"), owner("b", false)]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }, KEY).ok, false)
})

test("changing someone who is not a live owner always passes", () => {
    const members = [owner("a"), staff("b"), owner("c", false)]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "b" }, KEY).ok, true)
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "c" }, KEY).ok, true)
})

test("moving to another role that can own is fine, and so is a wildcard role", () => {
    assert.equal(checkOwnerRule([owner("a")], { type: "set_role", assignmentId: "a", newPermissions: OWNER_ROLE }, KEY).ok, true)
})

test("an unknown assignment is refused", () => {
    assert.equal(checkOwnerRule([owner("a")], { type: "remove", assignmentId: "zzz" }, KEY).ok, false)
})

test("a wildcard role counts as a role that can own", () => {
    assert.equal(checkOwnerRule([owner("a")], { type: "set_role", assignmentId: "a", newPermissions: ["*"] }, KEY).ok, true)
})

test("the rule follows the permission, not a name: any role that holds the key makes an owner", () => {
    // "Director", a custom role with the ownership key, is enough to let the first owner go
    const members = [owner("a"), owner("director")]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }, KEY).ok, true)
})

test("business owners use the business key", () => {
    const biz = OWNERSHIP_KEY.BUSINESS
    assert.equal(checkOwnerRule([owner("a")], { type: "set_role", assignmentId: "a", newPermissions: [biz] }, biz).ok, true)
    assert.equal(checkOwnerRule([owner("a")], { type: "set_role", assignmentId: "a", newPermissions: [KEY] }, biz).ok, false)
})
