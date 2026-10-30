// lib/business-input.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { parseBusinessFields, type BusinessSnapshot } from "@/lib/businesses/business-input"

const current: BusinessSnapshot = {
    name: "Carthage Materials",
    legalName: null,
    taxId: null,
    registryNumber: null,
    billingEmail: null,
    billingPhone: null,
    billingAddress: null,
}

const good = (body: unknown, cur = current) => {
    const r = parseBusinessFields(body, cur)
    assert.equal(r.ok, true, r.ok ? "" : r.error)
    return r.ok ? r.value : (undefined as never)
}
const bad = (body: unknown, cur = current) => {
    const r = parseBusinessFields(body, cur)
    assert.equal(r.ok, false)
    return r.ok ? "" : r.error
}

test("only the fields that were sent are returned", () => {
    const r = good({ billingAddress: "  12 Rue de Carthage, Tunis " })
    assert.deepEqual(r.data, { billingAddress: "12 Rue de Carthage, Tunis" })
    assert.deepEqual(r.changed, ["billingAddress"])
    assert.equal(r.legal, false)
})

test("a value that does not change is not reported as changed", () => {
    const r = good({ name: "Carthage Materials", legalName: "" })
    assert.deepEqual(r.changed, [])
})

test("the business name is required and at least 2 characters", () => {
    assert.match(bad({ name: "  " }), /required/)
    assert.match(bad({ name: "A" }), /too short/)
    assert.match(bad({ name: "x".repeat(101) }), /too long/)
})

test("legal fields are marked so the route can ask for the stronger permission", () => {
    assert.equal(good({ legalName: "Carthage Materials SARL" }).legal, true)
    assert.equal(good({ taxId: "1234567/a/m/000" }).legal, true)
    assert.equal(good({ registryNumber: "b01234562020" }).legal, true)
    assert.equal(good({ billingPhone: "20123456" }).legal, false)
})

test("tax and registry numbers are uppercased, tidied and restricted", () => {
    assert.equal(good({ taxId: " 1234567/a/m/000 " }).data.taxId, "1234567/A/M/000")
    assert.equal(good({ taxId: "1234567  A" }).data.taxId, "1234567 A")
    assert.match(bad({ taxId: "12<script>" }), /letters, digits/)
    assert.equal(good({ taxId: "" }).data.taxId, null)
})

test("billing email is checked and lowercased; empty clears it", () => {
    assert.equal(good({ billingEmail: " Compta@Carthage.TN " }).data.billingEmail, "compta@carthage.tn")
    assert.match(bad({ billingEmail: "nope" }), /^Billing email: enter a valid email/)
    assert.equal(good({ billingEmail: "" }).data.billingEmail, null)
})

test("billing phone must be a Tunisian number and is stored as +216", () => {
    assert.equal(good({ billingPhone: "20 123 456" }).data.billingPhone, "+21620123456")
    assert.match(bad({ billingPhone: "123" }), /Tunisian number/)
})

test("non-text values and non-objects are refused", () => {
    assert.match(bad({ legalName: 42 }), /must be text/)
    assert.equal(bad(null), "Invalid request")
    assert.equal(bad([]), "Invalid request")
})
