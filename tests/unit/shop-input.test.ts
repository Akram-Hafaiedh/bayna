// lib/shop-input.test.ts
// Run: npm run test:unit
import { test } from "vitest"
import assert from "node:assert/strict"
import { formatPhone, parsePhone, parseProfileFields, type ProfileSnapshot } from "@/lib/shop-input"
import { findGovernorate } from "@/lib/governorates"

const sfax = findGovernorate("Sfax")!

const saved: ProfileSnapshot = {
    name: "Sfax Hardware",
    description: "Tools and paint",
    phone: "+21620123456",
    whatsapp: null,
    address: "Route de Tunis km 3",
    city: "Sfax",
    governorate: "Sfax",
    latitude: sfax.latitude,
    longitude: sfax.longitude,
    locationSource: "LOOKUP",
}

const okResult = (r: ReturnType<typeof parseProfileFields>) => {
    if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
    return r.value
}
const errorOf = (r: ReturnType<typeof parseProfileFields>) => {
    if (r.ok) throw new Error("expected an error")
    return r.error
}

// ---- phone ------------------------------------------------------------------------------------

test("parsePhone normalises the usual ways of writing a Tunisian number", () => {
    for (const input of ["20 123 456", "+216 20 123 456", "00216 20123456", "216-20-123-456", "(20) 123.456", "20123456"]) {
        const r = parsePhone(input, "Phone")
        assert.deepEqual(r, { ok: true, value: "+21620123456" }, input)
    }
})

test("parsePhone treats empty as none and rejects other numbers", () => {
    assert.deepEqual(parsePhone("", "Phone"), { ok: true, value: null })
    assert.deepEqual(parsePhone("   ", "Phone"), { ok: true, value: null })
    assert.deepEqual(parsePhone(null, "Phone"), { ok: true, value: null })
    for (const bad of ["12345", "+33 6 12 34 56 78", "0123456789", "10 123 456", "abc", "+216 20 123 45"]) {
        assert.equal(parsePhone(bad, "Phone").ok, false, bad)
    }
    assert.equal(parsePhone(42, "Phone").ok, false)
})

test("formatPhone groups digits and leaves other values alone", () => {
    assert.equal(formatPhone("+21620123456"), "+216 20 123 456")
    assert.equal(formatPhone(null), "")
    assert.equal(formatPhone("0612"), "0612")
})

// ---- creating (the application form) ----------------------------------------------------------

test("creating needs a shop name, a city and a governorate", () => {
    assert.match(errorOf(parseProfileFields({ city: "Sfax", governorate: "Sfax" }, null)), /Shop name is required/)
    assert.match(errorOf(parseProfileFields({ name: "A", city: "Sfax", governorate: "Sfax" }, null)), /too short/)
    assert.match(errorOf(parseProfileFields({ name: "Shop", governorate: "Sfax" }, null)), /City is required/)
    assert.match(errorOf(parseProfileFields({ name: "Shop", city: "Sfax" }, null)), /governorate/i)
    assert.match(errorOf(parseProfileFields({ name: "Shop", city: "Sfax", governorate: "Paris" }, null)), /governorates/)
})

test("creating without a pin starts from the governorate centre", () => {
    const r = okResult(parseProfileFields({ name: "  Shop  ", city: "Sfax", governorate: "sfax" }, null))
    assert.equal(r.data.name, "Shop")
    assert.equal(r.data.governorate, "Sfax")
    assert.equal(r.data.latitude, sfax.latitude)
    assert.equal(r.data.longitude, sfax.longitude)
    assert.equal(r.data.locationSource, "LOOKUP")
})

test("creating with a pin keeps the pin and records how it was set", () => {
    const r = okResult(
        parseProfileFields({ name: "Shop", city: "Sfax", governorate: "Sfax", latitude: 34.75, longitude: 10.72, locationSource: "GEOCODED" }, null)
    )
    assert.equal(r.data.latitude, 34.75)
    assert.equal(r.data.locationSource, "GEOCODED")
    const defaulted = okResult(
        parseProfileFields({ name: "Shop", city: "Sfax", governorate: "Sfax", latitude: 34.75, longitude: 10.72 }, null)
    )
    assert.equal(defaulted.data.locationSource, "PIN")
})

test("a body that is not an object is refused", () => {
    for (const bad of [null, undefined, "x", 5, []]) assert.equal(parseProfileFields(bad, null).ok, false)
})

// ---- the pin ----------------------------------------------------------------------------------

test("the pin needs both numbers and must be inside Tunisia", () => {
    const base = { name: "Shop", city: "Sfax", governorate: "Sfax" }
    assert.match(errorOf(parseProfileFields({ ...base, latitude: 34.7 }, null)), /both be numbers/)
    assert.match(errorOf(parseProfileFields({ ...base, latitude: "34.7", longitude: "10.7" }, null)), /both be numbers/)
    assert.match(errorOf(parseProfileFields({ ...base, latitude: 48.85, longitude: 2.35 }, null)), /inside Tunisia/)
    assert.match(errorOf(parseProfileFields({ ...base, latitude: 0, longitude: 0 }, null)), /inside Tunisia/)
})

test("a pin far from the chosen governorate is refused, one near it is accepted", () => {
    const base = { name: "Shop", city: "Sfax", governorate: "Sfax" }
    // Tunis is about 235 km from the Sfax centre: allowed (large governorates exist)
    assert.equal(parseProfileFields({ ...base, latitude: 36.8, longitude: 10.17 }, null).ok, true)
    // Tozeur (south west) is about 300 km from Sfax
    assert.match(errorOf(parseProfileFields({ ...base, latitude: 33.917, longitude: 8.133 }, null)), /km from Sfax/)
})

test("an unknown location source is refused, IMPORTED cannot be claimed", () => {
    const base = { name: "Shop", city: "Sfax", governorate: "Sfax", latitude: 34.7, longitude: 10.7 }
    assert.match(errorOf(parseProfileFields({ ...base, locationSource: "IMPORTED" }, null)), /Invalid location source/)
    assert.match(errorOf(parseProfileFields({ ...base, locationSource: "MAGIC" }, null)), /Invalid location source/)
})

// ---- updating a saved profile -----------------------------------------------------------------

test("a partial update changes only what was sent", () => {
    const r = okResult(parseProfileFields({ description: "New text" }, saved))
    assert.deepEqual(r.data, { description: "New text" })
    assert.deepEqual(r.changed, ["description"])
})

test("sending the same values changes nothing", () => {
    const r = okResult(
        parseProfileFields({ name: "Sfax Hardware", phone: "20 123 456", city: "Sfax", latitude: sfax.latitude, longitude: sfax.longitude }, saved)
    )
    assert.deepEqual(r.changed, [])
    assert.equal(r.sensitive, false)
})

test("phone, WhatsApp and description changes are not sensitive", () => {
    const r = okResult(parseProfileFields({ phone: "21 000 000", whatsapp: "+216 22 000 000", description: "x" }, saved))
    assert.deepEqual(r.changed.sort(), ["description", "phone", "whatsapp"])
    assert.equal(r.sensitive, false)
})

test("name, address, city, governorate and location changes are sensitive", () => {
    assert.equal(okResult(parseProfileFields({ name: "Other Name" }, saved)).sensitive, true)
    assert.equal(okResult(parseProfileFields({ address: "Another street" }, saved)).sensitive, true)
    assert.equal(okResult(parseProfileFields({ city: "Mahres" }, saved)).sensitive, true)
    assert.equal(okResult(parseProfileFields({ latitude: 34.76, longitude: 10.74 }, saved)).sensitive, true)
})

test("moving the pin is recorded as a location change with the PIN source", () => {
    const r = okResult(parseProfileFields({ latitude: 34.76, longitude: 10.74 }, saved))
    assert.deepEqual(r.changed, ["location"])
    assert.equal(r.data.locationSource, "PIN")
})

test("changing the governorate without a pin moves the location to the new centre", () => {
    const sousse = findGovernorate("Sousse")!
    const r = okResult(parseProfileFields({ governorate: "Sousse" }, saved))
    assert.equal(r.data.latitude, sousse.latitude)
    assert.equal(r.data.locationSource, "LOOKUP")
    assert.deepEqual(r.changed.sort(), ["governorate", "location"])
    assert.equal(r.sensitive, true)
})

test("changing the governorate while keeping a pin that is now too far is refused", () => {
    assert.match(errorOf(parseProfileFields({ governorate: "Tozeur", latitude: sfax.latitude, longitude: sfax.longitude }, saved)), /km from Tozeur/)
})

test("an old profile without coordinates gets the governorate centre on its next save", () => {
    const legacy: ProfileSnapshot = { ...saved, latitude: null, longitude: null, locationSource: null }
    const r = okResult(parseProfileFields({ description: "x" }, legacy))
    assert.equal(r.data.latitude, sfax.latitude)
    assert.equal(r.data.locationSource, "LOOKUP")
})

test("an old profile whose governorate is not in the list can still change its description", () => {
    const legacy: ProfileSnapshot = { ...saved, governorate: "Grand Tunis", latitude: 36.8, longitude: 10.17 }
    const r = okResult(parseProfileFields({ description: "x" }, legacy))
    assert.deepEqual(r.changed, ["description"])
})

test("limits: description 2000, address 200, name 120, city 80", () => {
    assert.equal(parseProfileFields({ description: "x".repeat(2001) }, saved).ok, false)
    assert.equal(parseProfileFields({ description: "x".repeat(2000) }, saved).ok, true)
    assert.equal(parseProfileFields({ address: "x".repeat(201) }, saved).ok, false)
    assert.equal(parseProfileFields({ name: "x".repeat(121) }, saved).ok, false)
    assert.equal(parseProfileFields({ city: "x".repeat(81) }, saved).ok, false)
    assert.equal(parseProfileFields({ name: "" }, saved).ok, false, "cannot blank the name")
})
