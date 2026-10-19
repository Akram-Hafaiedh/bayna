// lib/access/invite-token.ts
// The secret in an invite link. Only its hash is stored (like a password reset token), so a copy of
// the database cannot be used to join a shop. Pure apart from the random generator (unit tested).
import { createHash, randomBytes } from "node:crypto"

export const INVITE_TTL_DAYS = 7

/** 32 random bytes, URL-safe (43 characters). Shown once, when the invite is created. */
export function newInviteToken(): string {
    return randomBytes(32).toString("base64url")
}

export function hashInviteToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
}

/** Cheap shape check, so garbage in the URL never reaches the database. */
export function isPlausibleToken(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function inviteExpiry(now: Date = new Date(), days: number = INVITE_TTL_DAYS): Date {
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export type InviteState = "pending" | "expired" | "revoked" | "accepted"

export function inviteState(
    invite: { status: "PENDING" | "ACCEPTED" | "REVOKED"; expiresAt: Date },
    now: Date = new Date()
): InviteState {
    if (invite.status === "ACCEPTED") return "accepted"
    if (invite.status === "REVOKED") return "revoked"
    return invite.expiresAt.getTime() > now.getTime() ? "pending" : "expired"
}
