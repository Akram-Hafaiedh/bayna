// lib/shop-setup.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { shopSetup, type ShopSetupInput } from "@/lib/shops/shop-setup"

const full: ShopSetupInput = {
    description: "Cement and steel",
    phone: "+21620111222",
    whatsapp: "+21620111222",
    address: "12 Rue Habib Bourguiba",
    city: "Tunis",
    governorate: "Tunis",
    latitude: 36.8,
    longitude: 10.18,
    status: "ACTIVE",
}

test("a complete, approved shop has nothing missing", () => {
    const s = shopSetup(full)
    assert.equal(s.missing, 0)
    assert.equal(s.complete, true)
})

test("a new shop with only the essentials lists what is still to fill in", () => {
    const s = shopSetup({ ...full, description: null, address: "  ", latitude: null, longitude: null, whatsapp: null, status: "PENDING" })
    assert.deepEqual(s.items.filter((i) => !i.done && !i.optional).map((i) => i.key), ["address", "pin", "description"])
    assert.equal(s.missing, 3)
    assert.equal(s.complete, false)
})

test("WhatsApp is optional: it never counts as missing", () => {
    const s = shopSetup({ ...full, whatsapp: null })
    assert.equal(s.missing, 0)
    assert.equal(s.items.find((i) => i.key === "whatsapp")?.done, false)
})

test("details can all be there while the shop still waits for approval", () => {
    const s = shopSetup({ ...full, status: "PENDING" })
    assert.equal(s.missing, 0)
    assert.equal(s.complete, false)
})
