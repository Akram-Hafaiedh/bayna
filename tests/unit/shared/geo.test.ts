// tests/unit/shared/geo.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { distanceKm, isInTunisia } from "@/lib/shared/geo"
import { GOVERNORATES, GOVERNORATE_NAMES, findGovernorate, governorateCentre } from "@/lib/shared/governorates"

test("there are 24 governorates, with unique names and Arabic names", () => {
    assert.equal(GOVERNORATES.length, 24)
    assert.equal(new Set(GOVERNORATE_NAMES).size, 24)
    assert.equal(new Set(GOVERNORATES.map((g) => g.nameAr)).size, 24)
    for (const g of GOVERNORATES) assert.ok(g.nameAr.length >= 3, g.name)
})

test("every governorate centre is inside the Tunisia bounds", () => {
    for (const g of GOVERNORATES) assert.ok(isInTunisia(governorateCentre(g)), g.name)
})

test("findGovernorate ignores case, accents and extra spaces", () => {
    assert.equal(findGovernorate("gabes")?.name, "Gabès")
    assert.equal(findGovernorate("  BEJA ")?.name, "Béja")
    assert.equal(findGovernorate("sidi   bouzid")?.name, "Sidi Bouzid")
    assert.equal(findGovernorate("Paris"), undefined)
    assert.equal(findGovernorate(""), undefined)
    assert.equal(findGovernorate(42), undefined)
})

test("isInTunisia rejects impossible points", () => {
    assert.equal(isInTunisia({ latitude: 36.8, longitude: 10.17 }), true)
    assert.equal(isInTunisia({ latitude: 0, longitude: 0 }), false)
    assert.equal(isInTunisia({ latitude: 10.17, longitude: 36.8 }), false, "swapped")
    assert.equal(isInTunisia({ latitude: Number.NaN, longitude: 10 }), false)
    assert.equal(isInTunisia({ latitude: 48.85, longitude: 2.35 }), false)
})

test("distanceKm is zero for the same point and about right for Tunis to Sfax", () => {
    const tunis = governorateCentre(findGovernorate("Tunis")!)
    const sfax = governorateCentre(findGovernorate("Sfax")!)
    assert.equal(distanceKm(tunis, tunis), 0)
    const d = distanceKm(tunis, sfax)
    assert.ok(d > 225 && d < 245, `Tunis to Sfax in a straight line is about 235 km, got ${d.toFixed(1)}`)
    assert.ok(Math.abs(distanceKm(tunis, sfax) - distanceKm(sfax, tunis)) < 1e-9)
})

test("no two governorate centres are the same point", () => {
    const seen = new Set(GOVERNORATES.map((g) => `${g.latitude},${g.longitude}`))
    assert.equal(seen.size, 24)
})
