// lib/user-list.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { buildUsersHref, NO_USER_QUERY, parseUserQuery, userWhere } from "@/lib/users/user-list"

test("an empty address means the defaults", () => {
    assert.deepEqual(parseUserQuery({}), NO_USER_QUERY)
})

test("unknown or broken values fall back instead of failing", () => {
    const q = parseUserQuery({ role: "boss", status: "gone", page: "-3", pageSize: "7", q: "  amel  " })
    assert.deepEqual(q, { ...NO_USER_QUERY, q: "amel" })
})

test("a good address is read as it is", () => {
    const q = parseUserQuery(new URLSearchParams("q=karim&role=ADMIN&status=SUSPENDED&page=3&pageSize=50"))
    assert.deepEqual(q, { q: "karim", role: "ADMIN", status: "SUSPENDED", page: 3, pageSize: 50 })
})

test("links leave the defaults out, and a new filter goes back to page 1", () => {
    assert.equal(buildUsersHref(NO_USER_QUERY), "?")
    const here = { ...NO_USER_QUERY, q: "a", page: 4 }
    assert.equal(buildUsersHref(here, { status: "SUSPENDED" }), "?q=a&status=SUSPENDED")
    assert.equal(buildUsersHref(here, { page: 5 }), "?q=a&page=5")
    assert.equal(buildUsersHref(here, { pageSize: 50 }), "?q=a&pageSize=50")
})

test("every word of the search must match somewhere", () => {
    const where = userWhere({ ...NO_USER_QUERY, q: "amel carthage", role: "COMPANY" })
    assert.equal(where.role, "COMPANY")
    assert.equal(where.status, undefined)
    assert.equal((where.AND as unknown[]).length, 2)
    assert.equal(userWhere(NO_USER_QUERY).AND && (userWhere(NO_USER_QUERY).AND as unknown[]).length, 0)
})
