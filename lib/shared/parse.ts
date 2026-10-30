// lib/shared/parse.ts
// Small helpers shared by the input validators (lib/products/product-input.ts, lib/shops/shop-input.ts).
// Pure and dependency-free.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export const ok = <T>(value: T): Parsed<T> => ({ ok: true, value })
export const fail = <T>(error: string): Parsed<T> => ({ ok: false, error })

/**
 * Where to go after signing in or registering: the ?next= value, only when it is a path inside this
 * site ("/invite/abc"). Anything else ("https://evil.example", "//evil.example", "/\\evil") is ignored.
 */
export function safeNextPath(next: string | null | undefined): string | null {
    if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null
    return next
}

export const isBlank = (v: unknown) => v === undefined || v === null || v === ""

/** Trimmed text; empty becomes null. Rejects non-strings and over-long values. */
export function parseText(v: unknown, label: string, max: number): Parsed<string | null> {
    if (v === undefined || v === null) return ok(null)
    if (typeof v !== "string") return fail(`${label} must be text`)
    const t = v.trim()
    if (t.length > max) return fail(`${label} is too long (max ${max} characters)`)
    return ok(t || null)
}
