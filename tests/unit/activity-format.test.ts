// lib/activity-format.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { ACTIVITY_KINDS, describeActivity, kindFilter, parseKind } from "@/lib/audit/activity-format"

const BASE = "/shop/abc"
const row = (over: Partial<Parameters<typeof describeActivity>[0]>) => ({
    entityType: "Product", entityId: "p1", action: "UPDATE", changes: [], note: null, ...over,
})

test("a trigger row reads as a verb and a thing, with the changed fields", () => {
    const line = describeActivity(row({ changes: [{ field: "price", from: "12", to: "14" }, { field: "updatedAt", from: "a", to: "b" }] }), BASE)
    assert.equal(line.title, "Changed a product")
    assert.equal(line.detail, "price: 12 → 14")
    assert.equal(line.href, "/shop/abc/products/p1/edit")
})

test("a note wins over the generated title (team actions)", () => {
    const line = describeActivity(row({ entityType: "AccessAssignment", action: "TEAM_REMOVED", note: "removed Sami from Sfax BTP" }), BASE)
    assert.equal(line.title, "removed Sami from Sfax BTP")
    assert.equal(line.href, "/shop/abc/team")
    assert.equal(describeActivity(row({ entityType: "AccessAssignment", action: "TEAM_REMOVED" })).href, null)
})

test("a created row lists no field detail; more than three changes are summarised", () => {
    assert.equal(describeActivity(row({ action: "CREATE", changes: [{ field: "name", from: null, to: "Cement" }] })).detail, null)
    const many = ["a", "b", "c", "d", "e"].map((f) => ({ field: f, from: 1, to: 2 }))
    assert.match(describeActivity(row({ changes: many })).detail ?? "", /and 2 more$/)
})

test("empty values and long values are shortened", () => {
    const d = describeActivity(row({ changes: [{ field: "note", from: null, to: "x".repeat(80) }] })).detail ?? ""
    assert.match(d, /^note: empty → x{37}\.\.\.$/)
})

test("trash and restore link where the product can be found", () => {
    assert.equal(describeActivity(row({ action: "SOFT_DELETE" }), BASE).href, "/shop/abc/products/trash")
    assert.equal(describeActivity(row({ action: "SOFT_DELETE" })).title, "Moved to trash: a product")
    assert.equal(describeActivity(row({ action: "DELETE" }), BASE).href, null)
})

test("odd data does not break it", () => {
    assert.equal(describeActivity(row({ changes: "nope" })).detail, null)
    assert.equal(describeActivity(row({ changes: [null, 3, { field: 5 }] })).detail, null)
    assert.equal(describeActivity(row({ entityType: "Mystery", action: "WEIRD" })).title, "WEIRD Mystery")
})

test("filters", () => {
    assert.deepEqual(kindFilter("products"), { entityType: "Product" })
    assert.deepEqual(kindFilter("shop"), { entityType: "Shop" })
    assert.deepEqual(kindFilter("team"), { action: { startsWith: "TEAM_" } })
    assert.ok("NOT" in kindFilter("all"))
    assert.equal(parseKind("team"), "team")
    assert.equal(parseKind("zzz"), "all")
    assert.equal(parseKind(undefined), "all")
    assert.equal(ACTIVITY_KINDS[0].key, "all")
})
