// lib/auth/reset-token.ts
// The secret in a password reset link. Only its hash is stored in `PasswordResetToken.token`, like the
// secret of an invite link, so a copy of the database cannot be used to take over an account.
// Pure apart from the random generator (unit tested).
import { createHash, randomBytes } from "node:crypto"

/** A new secret: `token` goes into the link and is never stored; `hash` is what the table keeps. */
export function newResetToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("hex")
    return { token, hash: hashResetToken(token) }
}

export function hashResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
}
