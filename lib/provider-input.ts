// lib/provider-input.ts
// Validation of the shop profile coming from API request bodies. One parser serves the application
// form (creating, `current` is null) and the profile page (updating, `current` is the saved row), so
// both ask for the same things in the same way.
//
// Rules
//   - businessName 2..120 and city 2..80 are required when creating; when updating they are only
//     checked if sent
//   - governorate must be one of the 24 (lib/governorates.ts) and is stored with its canonical spelling
//   - phone and WhatsApp are Tunisian numbers, stored as +216XXXXXXXX
//   - the map pin is latitude + longitude together, inside Tunisia, and not absurdly far from the
//     chosen governorate. Without a pin, the governorate centre is used (source LOOKUP)
//   - the result says which fields really changed and whether a verified shop must be flagged for admin
//     review (name, address, city, governorate or location; phone, WhatsApp and description are not)
import { distanceKm, isInTunisia } from "./geo"
import { findGovernorate } from "./governorates"
import { fail, ok, parseText, type Parsed } from "./parse"

/** A pin farther than this from the governorate centre is refused (the largest governorates are ~200 km across). */
export const MAX_PIN_DISTANCE_KM = 250

/** Sources a client may claim. IMPORTED is only set by seeds and scripts. */
export const CLIENT_LOCATION_SOURCES = ["LOOKUP", "PIN", "GEOCODED"] as const
export type ClientLocationSource = (typeof CLIENT_LOCATION_SOURCES)[number]

export type ProfileSnapshot = {
    businessName: string
    description: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    city: string
    governorate: string | null
    latitude: number | null
    longitude: number | null
    locationSource: string | null
}

/** What to write. Only the keys that were sent (or derived) are present. */
export type ProfileData = {
    businessName?: string
    description?: string | null
    phone?: string | null
    whatsapp?: string | null
    address?: string | null
    city?: string
    governorate?: string
    latitude?: number
    longitude?: number
    locationSource?: ClientLocationSource
}

export type ProfileChange = "businessName" | "description" | "phone" | "whatsapp" | "address" | "city" | "governorate" | "location"

export type ProfileResult = {
    data: ProfileData
    /** Fields whose value really differs from the saved one (everything, when creating) */
    changed: ProfileChange[]
    /** True when a verified shop's change should be flagged for admin review */
    sensitive: boolean
}

const SENSITIVE: ProfileChange[] = ["businessName", "address", "city", "governorate", "location"]

/** Tunisian number to +216XXXXXXXX. Empty means "none" (null). */
export function parsePhone(v: unknown, label: string): Parsed<string | null> {
    if (v === undefined || v === null) return ok(null)
    if (typeof v !== "string") return fail(`${label} must be text`)
    const raw = v.trim()
    if (!raw) return ok(null)
    const compact = raw.replace(/[\s.\-()]/g, "")
    const m = /^(?:\+216|00216|216)?([2-9]\d{7})$/.exec(compact)
    if (!m) return fail(`${label} must be a Tunisian number: 8 digits, with or without +216`)
    return ok(`+216${m[1]}`)
}

/** +21612345678 to "+216 12 345 678". Anything else is returned as it is. */
export function formatPhone(v: string | null | undefined): string {
    if (!v) return ""
    const m = /^\+216(\d{2})(\d{3})(\d{3})$/.exec(v)
    return m ? `+216 ${m[1]} ${m[2]} ${m[3]}` : v
}

function parseRequiredText(v: unknown, label: string, min: number, max: number): Parsed<string> {
    const r = parseText(v, label, max)
    if (!r.ok) return fail(r.error)
    if (!r.value) return fail(`${label} is required`)
    if (r.value.length < min) return fail(`${label} is too short (min ${min} characters)`)
    return ok(r.value)
}

const SAME_PLACE = 1e-6

export function parseProfileFields(body: unknown, current: ProfileSnapshot | null): Parsed<ProfileResult> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Invalid request")
    const b = body as Record<string, unknown>
    const creating = current === null
    const data: ProfileData = {}

    if (creating || b.businessName !== undefined) {
        const r = parseRequiredText(b.businessName, "Business name", 2, 120)
        if (!r.ok) return r
        data.businessName = r.value
    }
    if (creating || b.city !== undefined) {
        const r = parseRequiredText(b.city, "City", 2, 80)
        if (!r.ok) return r
        data.city = r.value
    }
    if (b.description !== undefined) {
        const r = parseText(b.description, "Description", 2000)
        if (!r.ok) return r
        data.description = r.value
    }
    if (b.address !== undefined) {
        const r = parseText(b.address, "Address", 200)
        if (!r.ok) return r
        data.address = r.value
    }
    if (b.phone !== undefined) {
        const r = parsePhone(b.phone, "Phone")
        if (!r.ok) return r
        data.phone = r.value
    }
    if (b.whatsapp !== undefined) {
        const r = parsePhone(b.whatsapp, "WhatsApp number")
        if (!r.ok) return r
        data.whatsapp = r.value
    }
    if (creating || b.governorate !== undefined) {
        const g = findGovernorate(b.governorate)
        if (!g) return fail("Choose one of the 24 governorates")
        data.governorate = g.name
    }

    // ---- location -----------------------------------------------------------------------------
    const gov = findGovernorate(data.governorate ?? current?.governorate)
    const governorateChanged = data.governorate !== undefined && data.governorate !== (current?.governorate ?? null)
    const sentPin = b.latitude !== undefined || b.longitude !== undefined

    if (sentPin) {
        const lat = b.latitude
        const lng = b.longitude
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return fail("Latitude and longitude must both be numbers")
        }
        if (!isInTunisia({ latitude: lat, longitude: lng })) return fail("The location must be inside Tunisia")
        let source: ClientLocationSource = "PIN"
        if (b.locationSource !== undefined) {
            if (!(CLIENT_LOCATION_SOURCES as readonly unknown[]).includes(b.locationSource)) {
                return fail("Invalid location source")
            }
            source = b.locationSource as ClientLocationSource
        }
        data.latitude = lat
        data.longitude = lng
        data.locationSource = source
    } else if (gov && (creating || governorateChanged || current?.latitude == null || current?.longitude == null)) {
        // No pin sent: start from the governorate centre
        data.latitude = gov.latitude
        data.longitude = gov.longitude
        data.locationSource = "LOOKUP"
    }

    // A new pin or a new governorate must agree with each other
    if (gov && (data.latitude !== undefined || data.governorate !== undefined)) {
        const lat = data.latitude ?? current?.latitude
        const lng = data.longitude ?? current?.longitude
        if (lat != null && lng != null) {
            const d = distanceKm({ latitude: gov.latitude, longitude: gov.longitude }, { latitude: lat, longitude: lng })
            if (d > MAX_PIN_DISTANCE_KM) {
                return fail(`The pin is about ${Math.round(d)} km from ${gov.name}. Choose the right governorate or move the pin.`)
            }
        }
    }

    // ---- what really changed ------------------------------------------------------------------
    const changed: ProfileChange[] = []
    const text = ["businessName", "description", "phone", "whatsapp", "address", "city", "governorate"] as const
    for (const key of text) {
        if (data[key] !== undefined && data[key] !== (current?.[key] ?? null)) changed.push(key)
    }
    if (data.latitude !== undefined && data.longitude !== undefined) {
        const moved =
            current?.latitude == null ||
            current?.longitude == null ||
            Math.abs(data.latitude - current.latitude) > SAME_PLACE ||
            Math.abs(data.longitude - current.longitude) > SAME_PLACE
        if (moved) changed.push("location")
    }

    return ok({ data, changed, sensitive: changed.some((c) => SENSITIVE.includes(c)) })
}
