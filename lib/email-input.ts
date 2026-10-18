// lib/email-input.ts
// One way to write an email address everywhere (register, sign in, forgot and reset password), so
// "Sami@Mail.com " and "sami@mail.com" can never be two accounts.
import { fail, ok, type Parsed } from "@/lib/parse"

/** Trimmed and lowercase. Does not check the shape; use parseEmail for input from a person. */
export function normalizeEmail(v: string): string {
    return v.trim().toLowerCase()
}

/** A valid-looking address, normalised. Deliberately simple: one @, something on each side, a dot in the domain. */
export function parseEmail(v: unknown): Parsed<string> {
    if (typeof v !== "string") return fail("Email is required")
    const email = normalizeEmail(v)
    if (!email) return fail("Email is required")
    if (email.length > 254) return fail("Email is too long")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("Enter a valid email address")
    return ok(email)
}
