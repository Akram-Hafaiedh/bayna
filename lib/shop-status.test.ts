// lib/shop-status.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { actionsFor, isLive, isShopStatus, isWaiting, moveFor, SHOP_STATUSES, SHOP_STATUS_LABEL, SHOP_STATUS_TONE } from "./shop-status"

test("every status has a label and a tone", () => {
    for (const s of SHOP_STATUSES) {
        assert.ok(SHOP_STATUS_LABEL[s])
        assert.ok(SHOP_STATUS_TONE[s])
    }
})

test("only ACTIVE is live; DRAFT and PENDING are waiting", () => {
    assert.deepEqual(SHOP_STATUSES.filter(isLive), ["ACTIVE"])
    assert.deepEqual(SHOP_STATUSES.filter(isWaiting), ["DRAFT", "PENDING"])
})

test("owners can close and reopen, but not approve or lift a suspension", () => {
    assert.deepEqual(actionsFor("ACTIVE", "owner").map((m) => m.action), ["close"])
    assert.deepEqual(actionsFor("CLOSED", "owner").map((m) => m.action), ["reopen"])
    assert.deepEqual(actionsFor("PENDING", "owner"), [])
    assert.deepEqual(actionsFor("SUSPENDED", "owner"), [])
})

test("the platform team approves, suspends and reinstates", () => {
    assert.deepEqual(actionsFor("PENDING", "platform").map((m) => m.action), ["approve"])
    assert.deepEqual(actionsFor("ACTIVE", "platform").map((m) => m.action), ["suspend"])
    assert.deepEqual(actionsFor("SUSPENDED", "platform").map((m) => m.action), ["reinstate"])
})

test("a draft is sent for approval by its owner", () => {
    assert.equal(moveFor("submit", "DRAFT")?.to, "PENDING")
    assert.equal(moveFor("submit", "ACTIVE"), null)
})

test("a closed shop cannot be reopened by approving, and a suspended one cannot be closed", () => {
    assert.equal(moveFor("approve", "CLOSED"), null)
    assert.equal(moveFor("close", "SUSPENDED"), null)
})

test("isShopStatus accepts only known values", () => {
    assert.equal(isShopStatus("ACTIVE"), true)
    assert.equal(isShopStatus("active"), false)
    assert.equal(isShopStatus(null), false)
})
