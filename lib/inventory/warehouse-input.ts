// lib/inventory/warehouse-input.ts
// Validation of a warehouse coming from an API request body. One parser serves creating (`current` is
// null) and editing. Rules: name 2..80 and city 2..80 are required when creating; the governorate is one
// of the 24; the map pin is latitude + longitude together, inside Tunisia and near the governorate (like a
// shop's pin, lib/shops/shop-input.ts); without a pin the governorate centre is used (source LOOKUP).
import { distanceKm, isInTunisia } from "@/lib/shared/geo"
import { findGovernorate } from "@/lib/shared/governorates"
import { fail, ok, parseText, type Parsed } from "@/lib/shared/parse"
import { CLIENT_LOCATION_SOURCES, MAX_PIN_DISTANCE_KM, type ClientLocationSource } from "@/lib/shops/shop-input"

export type WarehouseData = {
    name?: string
    address?: string | null
    city?: string
    governorate?: string
    latitude?: number
    longitude?: number
    locationSource?: ClientLocationSource
}

export type WarehouseSnapshot = {
    name: string
    address: string | null
    city: string
    governorate: string | null
    latitude: number | null
    longitude: number | null
}

function requiredText(v: unknown, label: string, min: number, max: number): Parsed<string> {
    const r = parseText(v, label, max)
    if (!r.ok) return fail(r.error)
    if (!r.value) return fail(`${label} is required`)
    if (r.value.length < min) return fail(`${label} is too short (min ${min} characters)`)
    return ok(r.value)
}

export function parseWarehouseFields(body: unknown, current: WarehouseSnapshot | null): Parsed<WarehouseData> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Invalid request")
    const b = body as Record<string, unknown>
    const creating = current === null
    const data: WarehouseData = {}

    if (creating || b.name !== undefined) {
        const r = requiredText(b.name, "Warehouse name", 2, 80)
        if (!r.ok) return r
        data.name = r.value
    }
    if (creating || b.city !== undefined) {
        const r = requiredText(b.city, "City", 2, 80)
        if (!r.ok) return r
        data.city = r.value
    }
    if (b.address !== undefined) {
        const r = parseText(b.address, "Address", 200)
        if (!r.ok) return r
        data.address = r.value
    }
    if (creating || b.governorate !== undefined) {
        const g = findGovernorate(b.governorate)
        if (!g) return fail("Choose one of the 24 governorates")
        data.governorate = g.name
    }

    const gov = findGovernorate(data.governorate ?? current?.governorate)
    const sentPin = b.latitude !== undefined || b.longitude !== undefined
    if (sentPin) {
        const lat = typeof b.latitude === "number" ? b.latitude : Number.NaN
        const lng = typeof b.longitude === "number" ? b.longitude : Number.NaN
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Send the map pin as a latitude and a longitude together")
        if (!isInTunisia({ latitude: lat, longitude: lng })) return fail("The map pin must be inside Tunisia")
        if (gov && distanceKm({ latitude: lat, longitude: lng }, { latitude: gov.latitude, longitude: gov.longitude }) > MAX_PIN_DISTANCE_KM) {
            return fail(`The map pin is too far from ${gov.name}. Check the governorate or move the pin.`)
        }
        data.latitude = lat
        data.longitude = lng
        const source = b.locationSource === undefined ? "PIN" : b.locationSource
        if (!(CLIENT_LOCATION_SOURCES as readonly string[]).includes(source as string)) return fail("Unknown location source")
        data.locationSource = source as ClientLocationSource
    } else if (creating && gov) {
        // No pin: start from the centre of the governorate, marked as a guess
        data.latitude = gov.latitude
        data.longitude = gov.longitude
        data.locationSource = "LOOKUP"
    } else if (!creating && data.governorate !== undefined && data.governorate !== current.governorate && gov) {
        // Moved to another governorate without a new pin: the old pin would be wrong
        data.latitude = gov.latitude
        data.longitude = gov.longitude
        data.locationSource = "LOOKUP"
    }
    return ok(data)
}
