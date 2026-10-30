// lib/slug.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { slugify } from "@/lib/shared/slug"

test("slugify lowercases, removes accents and joins words with dashes", () => {
    assert.equal(slugify("Ciment Gris 50kg"), "ciment-gris-50kg")
    assert.equal(slugify("Béton Armé"), "beton-arme")
    assert.equal(slugify("  --Tube PVC (Ø 32)--  "), "tube-pvc-32")
})

test("slugify gives an empty string when nothing usable is left", () => {
    assert.equal(slugify(""), "")
    assert.equal(slugify("***"), "")
    assert.equal(slugify("مواد"), "")
})
