// lib/access/active-shop.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { pickActiveShop } from "@/lib/access/active-shop"

test("no shops means no active shop", () => {
    assert.equal(pickActiveShop([], "s1"), null)
})

test("the remembered shop is used when the person still works there", () => {
    assert.equal(pickActiveShop(["s1", "s2", "s3"], "s2"), "s2")
})

test("a remembered shop the person does not work in is ignored", () => {
    assert.equal(pickActiveShop(["s1", "s2"], "s9"), "s1")
})

test("without a hint the first shop by id is used, whatever the input order", () => {
    assert.equal(pickActiveShop(["s3", "s1", "s2"]), "s1")
    assert.equal(pickActiveShop(["s3", "s1", "s2"], ""), "s1")
    assert.equal(pickActiveShop(["s2"], null), "s2")
})

test("duplicate ids do not matter", () => {
    assert.equal(pickActiveShop(["s2", "s2", "s1"], "s2"), "s2")
})
