// lib/user-status.ts
// What the platform team may do to a user account. Pure (unit tested); the admin routes and the users
// list both ask this file, so a button never shows for something the server would refuse.
//
//   ACTIVE            can sign in and work
//   SUSPENDED         cannot sign in; every open session is ended; the platform team can reinstate
//   BANNED            kept for later (no action yet)
//   PENDING_DELETION  kept for later (no action yet)

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED", "PENDING_DELETION"] as const
export type UserStatusValue = (typeof USER_STATUSES)[number]

export const USER_STATUS_LABEL: Record<UserStatusValue, string> = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    BANNED: "Banned",
    PENDING_DELETION: "Pending deletion",
}

export type UserAction = "suspend" | "reinstate" | "revoke_sessions" | "reset_password"

/** The status a suspend / reinstate leads to from `from`, or null when it is not allowed from there. */
export function userMove(action: "suspend" | "reinstate", from: UserStatusValue): UserStatusValue | null {
    if (action === "suspend") return from === "ACTIVE" ? "SUSPENDED" : null
    return from === "SUSPENDED" ? "ACTIVE" : null
}

/** The actions listed for a user in the admin list. Nobody acts on their own account from there. */
export function userActions(status: UserStatusValue, isSelf: boolean): UserAction[] {
    if (isSelf) return []
    if (status === "ACTIVE") return ["suspend", "revoke_sessions", "reset_password"]
    if (status === "SUSPENDED") return ["reinstate", "reset_password"]
    return []
}

/** A person cannot suspend, sign out or lock themselves out of their own account. */
export function checkTarget(actorId: string, targetId: string): { ok: true } | { ok: false; error: string } {
    return actorId === targetId ? { ok: false, error: "You cannot do this to your own account" } : { ok: true }
}

export const REASON_MIN = 3
export const REASON_MAX = 300

/** A suspension always says why; the person sees the reason and the activity log keeps it. */
export function parseReason(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
    const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : ""
    if (value.length < REASON_MIN) return { ok: false, error: "Say why the account is suspended" }
    if (value.length > REASON_MAX) return { ok: false, error: `The reason is too long (${REASON_MAX} characters at most)` }
    return { ok: true, value }
}
