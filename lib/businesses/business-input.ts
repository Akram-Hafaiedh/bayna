// lib/business-input.ts
// Checks what a business owner sends for the business page (name, legal and billing details).
// Pure (unit tested). Only the fields present in the request are looked at, so a form can send just
// what changed. Legal details (legal name, tax number, registry number) are separate from the rest
// because changing them needs a stronger permission (business.profile.edit_legal).
import { fail, ok, parseText, type Parsed } from "@/lib/shared/parse"
import { parseEmail } from "@/lib/auth/email-input"
import { parsePhone } from "@/lib/shops/shop-input"

export type BusinessSnapshot = {
    name: string
    legalName: string | null
    taxId: string | null
    registryNumber: string | null
    billingEmail: string | null
    billingPhone: string | null
    billingAddress: string | null
}

export type BusinessField = keyof BusinessSnapshot

export type BusinessResult = {
    /** only the fields that were sent, normalised */
    data: Partial<BusinessSnapshot>
    /** the fields whose value really changes */
    changed: BusinessField[]
    /** true when a legal field changes (needs business.profile.edit_legal) */
    legal: boolean
}

export const LEGAL_FIELDS: readonly BusinessField[] = ["legalName", "taxId", "registryNumber"]

/** Uppercase, single spaces. Letters, digits and / . - space only (a Tunisian matricule fiscal looks like 1234567/A/M/000). */
function parseReference(v: unknown, label: string): Parsed<string | null> {
    const t = parseText(v, label, 40)
    if (!t.ok) return t
    if (!t.value) return ok(null)
    const value = t.value.toUpperCase().replace(/\s+/g, " ")
    if (!/^[A-Z0-9/.\- ]+$/.test(value)) return fail(`${label} can only contain letters, digits and / . -`)
    return ok(value)
}

export function parseBusinessFields(body: unknown, current: BusinessSnapshot): Parsed<BusinessResult> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Invalid request")
    const b = body as Record<string, unknown>
    const data: Partial<BusinessSnapshot> = {}

    if (b.name !== undefined) {
        const r = parseText(b.name, "Business name", 100)
        if (!r.ok) return r
        if (!r.value) return fail("Business name is required")
        if (r.value.length < 2) return fail("Business name is too short (min 2 characters)")
        data.name = r.value
    }
    if (b.legalName !== undefined) {
        const r = parseText(b.legalName, "Legal name", 150)
        if (!r.ok) return r
        data.legalName = r.value
    }
    if (b.taxId !== undefined) {
        const r = parseReference(b.taxId, "Tax number")
        if (!r.ok) return r
        data.taxId = r.value
    }
    if (b.registryNumber !== undefined) {
        const r = parseReference(b.registryNumber, "Registry number")
        if (!r.ok) return r
        data.registryNumber = r.value
    }
    if (b.billingEmail !== undefined) {
        const raw = typeof b.billingEmail === "string" ? b.billingEmail.trim() : b.billingEmail
        if (raw === "" || raw === null) data.billingEmail = null
        else {
            const r = parseEmail(raw)
            if (!r.ok) return fail("Billing email: " + r.error.charAt(0).toLowerCase() + r.error.slice(1))
            data.billingEmail = r.value
        }
    }
    if (b.billingPhone !== undefined) {
        const r = parsePhone(b.billingPhone, "Billing phone")
        if (!r.ok) return r
        data.billingPhone = r.value
    }
    if (b.billingAddress !== undefined) {
        const r = parseText(b.billingAddress, "Billing address", 300)
        if (!r.ok) return r
        data.billingAddress = r.value
    }

    const changed = (Object.keys(data) as BusinessField[]).filter((k) => data[k] !== current[k])
    return ok({ data, changed, legal: changed.some((k) => LEGAL_FIELDS.includes(k)) })
}
