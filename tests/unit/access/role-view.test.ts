// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { groupPermissions, humanise } from "@/lib/access/role-view"

test("permission keys are grouped by module, then resource", () => {
    const groups = groupPermissions(["product.catalog.view", "product.catalog.edit", "product.bulk.import", "team.member.view"])
    assert.deepEqual(groups, [
        { module: "product", items: [{ resource: "bulk", actions: ["import"] }, { resource: "catalog", actions: ["edit", "view"] }] },
        { module: "team", items: [{ resource: "member", actions: ["view"] }] },
    ])
})

test("wildcards and malformed keys are skipped, duplicates collapse", () => {
    assert.deepEqual(groupPermissions(["*", "oops", "a.b.c", "a.b.c"]), [{ module: "a", items: [{ resource: "b", actions: ["c"] }] }])
    assert.deepEqual(groupPermissions([]), [])
})

test("underscores read as spaces", () => {
    assert.equal(humanise("view_all"), "view all")
})
