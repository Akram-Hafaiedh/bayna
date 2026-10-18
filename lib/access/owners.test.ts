// lib/access/owners.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { checkOwnerRule, type ShopMember } from "./owners"

const owner = (id: string, live = true): ShopMember => ({ id, roleKey: "OWNER", live })
const staff = (id: string, roleKey = "MANAGER", live = true): ShopMember => ({ id, roleKey, live })

test("the only owner cannot be removed, suspended or given another role", () => {
    const members = [owner("a"), staff("b")]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }).ok, false)
    assert.equal(checkOwnerRule(members, { type: "suspend", assignmentId: "a" }).ok, false)
    assert.equal(checkOwnerRule(members, { type: "set_role", assignmentId: "a", roleKey: "MANAGER" }).ok, false)
})

test("the error tells the person what to do", () => {
    const r = checkOwnerRule([owner("a")], { type: "remove", assignmentId: "a" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.error, /transfer ownership/)
})

test("one of two owners may go", () => {
    const members = [owner("a"), owner("b")]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }).ok, true)
})

test("an owner whose assignment or account is not live does not count as the other owner", () => {
    const members = [owner("a"), owner("b", false)]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "a" }).ok, false)
})

test("changing someone who is not a live owner always passes", () => {
    const members = [owner("a"), staff("b"), owner("c", false)]
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "b" }).ok, true)
    assert.equal(checkOwnerRule(members, { type: "remove", assignmentId: "c" }).ok, true)
})

test("keeping the owner role is fine", () => {
    assert.equal(checkOwnerRule([owner("a")], { type: "set_role", assignmentId: "a", roleKey: "OWNER" }).ok, true)
})

test("an unknown assignment is refused", () => {
    assert.equal(checkOwnerRule([owner("a")], { type: "remove", assignmentId: "zzz" }).ok, false)
})
