// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { cleanSection, lastShopPath, parseShopPath, shopPath } from "@/lib/shops/shop-paths"

test("shopPath builds the address of a shop page", () => {
    assert.equal(shopPath("abc"), "/shop/abc/dashboard")
    assert.equal(shopPath("abc", "team"), "/shop/abc/team")
    assert.equal(shopPath("abc", "/products/new"), "/shop/abc/products/new")
    assert.equal(shopPath("abc", ""), "/shop/abc")
})

test("parseShopPath finds the shop and the section", () => {
    assert.deepEqual(parseShopPath("/shop/abc/products/new"), { publicShopId: "abc", section: "products/new" })
    assert.deepEqual(parseShopPath("/shop/abc"), { publicShopId: "abc", section: "" })
    assert.deepEqual(parseShopPath("/shop/abc/team/"), { publicShopId: "abc", section: "team" })
})

test("parseShopPath ignores everything that is not a shop page", () => {
    assert.equal(parseShopPath("/shop"), null)
    assert.equal(parseShopPath("/business/team"), null)
    assert.equal(parseShopPath("/shops/abc"), null)
    assert.equal(parseShopPath(null), null)
})

test("lastShopPath points at the landing", () => {
    assert.equal(lastShopPath(), "/shop")
    assert.equal(lastShopPath("team"), "/shop?to=team")
})

test("cleanSection only lets safe section names through", () => {
    assert.equal(cleanSection("team"), "team")
    assert.equal(cleanSection("/products/trash/"), "products/trash")
    assert.equal(cleanSection("../admin"), "")
    assert.equal(cleanSection("//evil.example"), "")
    assert.equal(cleanSection("a b"), "")
    assert.equal(cleanSection(null), "")
})
