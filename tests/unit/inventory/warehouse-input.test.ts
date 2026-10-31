// tests/unit/inventory/warehouse-input.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { parseWarehouseFields, type WarehouseSnapshot } from "@/lib/inventory/warehouse-input"
import { findGovernorate } from "@/lib/shared/governorates"

const sfax = findGovernorate("Sfax")!
const tunis = findGovernorate("Tunis")!
const tozeur = findGovernorate("Tozeur")! // about 320 km from Tunis, beyond the 250 km allowed between a pin and its governorate

const saved: WarehouseSnapshot = {
    name: "Main warehouse", address: "Route de Gabes", city: "Sfax", governorate: "Sfax",
    latitude: sfax.latitude, longitude: sfax.longitude,
}
const good = { name: "Depot", city: "Sfax", governorate: "Sfax" }

const value = (r: ReturnType<typeof parseWarehouseFields>) => {
    if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
    return r.value
}
const error = (r: ReturnType<typeof parseWarehouseFields>) => {
    assert.equal(r.ok, false)
    return (r as { error: string }).error
}

test("creating: name, city and governorate are required", () => {
    assert.match(error(parseWarehouseFields({ city: "Sfax", governorate: "Sfax" }, null)), /name is required/i)
    assert.match(error(parseWarehouseFields({ name: "Depot", governorate: "Sfax" }, null)), /City is required/)
    assert.match(error(parseWarehouseFields({ name: "Depot", city: "Sfax" }, null)), /24 governorates/)
    assert.match(error(parseWarehouseFields({ ...good, name: "D" }, null)), /too short/)
    assert.match(error(parseWarehouseFields({ ...good, name: "x".repeat(81) }, null)), /too long/)
    assert.match(error(parseWarehouseFields("nope", null)), /Invalid request/)
    assert.match(error(parseWarehouseFields(null, null)), /Invalid request/)
})

test("creating without a pin uses the governorate centre, marked as a guess", () => {
    const d = value(parseWarehouseFields(good, null))
    assert.equal(d.latitude, sfax.latitude)
    assert.equal(d.longitude, sfax.longitude)
    assert.equal(d.locationSource, "LOOKUP")
    assert.equal(d.governorate, "Sfax")
})

test("a pin must come as a pair, inside Tunisia and near the governorate", () => {
    assert.match(error(parseWarehouseFields({ ...good, latitude: 34.7 }, null)), /together/)
    assert.match(error(parseWarehouseFields({ ...good, latitude: "34.7", longitude: "10.7" }, null)), /together/)
    assert.match(error(parseWarehouseFields({ ...good, latitude: 48.85, longitude: 2.35 }, null)), /inside Tunisia/)
    assert.match(error(parseWarehouseFields({ ...good, governorate: "Tunis", latitude: tozeur.latitude, longitude: tozeur.longitude }, null)), /too far from Tunis/)
    const d = value(parseWarehouseFields({ ...good, latitude: sfax.latitude + 0.01, longitude: sfax.longitude + 0.01 }, null))
    assert.equal(d.locationSource, "PIN")
    assert.equal(d.latitude, sfax.latitude + 0.01)
})

test("an unknown location source is refused", () => {
    assert.match(error(parseWarehouseFields({ ...good, latitude: sfax.latitude, longitude: sfax.longitude, locationSource: "MAGIC" }, null)), /location source/)
    assert.equal(value(parseWarehouseFields({ ...good, latitude: sfax.latitude, longitude: sfax.longitude, locationSource: "GEOCODED" }, null)).locationSource, "GEOCODED")
})

test("editing: only what is sent changes", () => {
    assert.deepEqual(value(parseWarehouseFields({}, saved)), {})
    assert.deepEqual(value(parseWarehouseFields({ name: "Back store" }, saved)), { name: "Back store" })
    assert.equal(value(parseWarehouseFields({ address: "  " }, saved)).address, null)
    assert.match(error(parseWarehouseFields({ name: "" }, saved)), /required/)
})

test("editing: another governorate without a pin resets the pin to its centre", () => {
    const d = value(parseWarehouseFields({ governorate: "Tunis" }, saved))
    assert.equal(d.governorate, "Tunis")
    assert.equal(d.latitude, tunis.latitude)
    assert.equal(d.longitude, tunis.longitude)
    assert.equal(d.locationSource, "LOOKUP")
    // the same governorate keeps the saved pin
    assert.equal(value(parseWarehouseFields({ governorate: "Sfax" }, saved)).latitude, undefined)
})
