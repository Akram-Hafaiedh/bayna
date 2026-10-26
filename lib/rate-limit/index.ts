// lib/rate-limit/index.ts
// What routes and auth.ts import: one limiter wired to the database, plus helpers.
import { createLimiter } from "./limiter"
import { dbStore } from "./db-store"
import type { RatePolicy } from "./policies"

export { RATE, RATE_LIMITED_CODE, RATE_LIMITED_MESSAGE, messageForRateLimitCode } from "./policies"
export type { RateResult } from "./limiter"

const globalForLimiter = globalThis as unknown as { baynaLimiter?: ReturnType<typeof createLimiter> }

// One per server instance, kept across hot reloads in development
const limiter =
    globalForLimiter.baynaLimiter ??
    createLimiter({
        shared: dbStore,
        onSharedError: (error) => console.error("Rate limit store unavailable, using memory only:", error),
    })
if (process.env.NODE_ENV !== "production") globalForLimiter.baynaLimiter = limiter

/** A subject of null (an address that could not be read) is not counted: there is nobody to attribute it to. */
type Check = { policy: RatePolicy; subject: string | null }
const present = (checks: Check[]) => checks.filter((c): c is { policy: RatePolicy; subject: string } => !!c.subject)

/** Count a try and refuse past the limit (register, forgot and reset password). */
export async function rateLimit(policy: RatePolicy, subject: string | null) {
    if (!subject) return { ok: true as const, remaining: policy.limit }
    return limiter.hit(policy, subject)
}

/** Look without counting: is any of these already at its limit? The first refusal wins. */
export async function checkRateLimits(checks: Check[]) {
    const results = await Promise.all(present(checks).map((c) => limiter.check(c.policy, c.subject)))
    return results.find((r) => !r.ok) ?? { ok: true as const }
}

/** Count a failed try against all of these. */
export async function recordRateLimits(checks: Check[]) {
    await Promise.all(present(checks).map((c) => limiter.record(c.policy, c.subject)))
}

export const clearRateLimit = limiter.clear

/**
 * The caller's address, or null when the request carries none (local development). The forwarded header can
 * be forged unless a trusted proxy (Vercel) overwrites it, so behind anything else treat the per-IP limits as
 * best effort and rely on the per-email ones.
 */
export function clientIp(req: Request): string | null {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    return forwarded || req.headers.get("x-real-ip")?.trim() || null
}

/** The 429 answer shared by the routes. */
export function tooManyRequests(retryAfterSec: number, message = "Too many attempts. Please wait a few minutes and try again.") {
    return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } })
}
