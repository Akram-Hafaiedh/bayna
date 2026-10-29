// lib/rate-limit/policies.ts
// How many tries each sensitive action allows. Pure data, no database, so it can be read and tested alone.
// Each policy is counted per key (the caller's IP, or an email address) inside a fixed window.

export type RatePolicy = {
    /** Part of the stored key, so two actions never share a counter. */
    name: string
    /** Tries allowed inside one window. For `hit` the (limit + 1)th try is refused; for sign-in these are FAILED tries. */
    limit: number
    windowMs: number
}

const MINUTE = 60 * 1000

export const RATE = {
    /** Sign-in, per IP (failed passwords only): stops one machine trying many accounts. Not used when the IP is unknown. */
    loginIp: { name: "login:ip", limit: 20, windowMs: 15 * MINUTE },
    /** Sign-in, per email (failed passwords only): stops many machines trying one account. Cleared by a good sign-in. */
    loginEmail: { name: "login:email", limit: 8, windowMs: 15 * MINUTE },
    registerIp: { name: "register:ip", limit: 5, windowMs: 60 * MINUTE },
    forgotIp: { name: "forgot:ip", limit: 5, windowMs: 15 * MINUTE },
    /** Per address, so nobody can fill a mailbox with reset links. Refused silently (see the route). */
    forgotEmail: { name: "forgot:email", limit: 3, windowMs: 60 * MINUTE },
    resetIp: { name: "reset:ip", limit: 10, windowMs: 15 * MINUTE },
    /** "View as", per staff member (wrong passwords only): the password is asked again before opening someone's account. */
    viewAsPassword: { name: "viewas:password", limit: 5, windowMs: 15 * MINUTE },
} as const satisfies Record<string, RatePolicy>

export const RATE_LIMITED_CODE = "too_many_attempts"
export const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a few minutes and try again."

/** The message for a sign-in `code`; null for any other code. */
export function messageForRateLimitCode(code: unknown): string | null {
    return code === RATE_LIMITED_CODE ? RATE_LIMITED_MESSAGE : null
}
