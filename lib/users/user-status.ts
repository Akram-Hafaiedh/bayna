// lib/users/user-status.ts
// What the platform team may do to a user account. Pure (unit tested); the admin routes and the users
// list both ask this file, so a button never shows for something the server would refuse.
//
//   ACTIVE            can sign in and work
//   SUSPENDED         cannot sign in; every open session is ended; the platform team can reinstate
//                     (the reason is kept in the activity log for the admins; the person is only told
//                     that the account is suspended)
//   BANNED            cannot sign in; every open session is ended; the platform team can lift the ban. It is a
//                     suspension that is meant to last: the email stays taken (the row is kept), so the person
//                     cannot simply register again. Same permissions as suspend and reinstate for now.
//   PENDING_DELETION  the person asked to delete their account (lib/users/account-deletion.ts). Not a block at sign-in:
//                     signing in with the right password cancels the deletion. Until then the guards refuse it.

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED", "PENDING_DELETION"] as const
export type UserStatusValue = (typeof USER_STATUSES)[number]

export const USER_STATUS_LABEL: Record<UserStatusValue, string> = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    BANNED: "Banned",
    PENDING_DELETION: "Pending deletion",
}

/**
 * What the sign-in page says to a person whose account cannot be used. It is only ever shown after the
 * right password was typed, so it does not tell a stranger that an email has an account.
 */
export const SIGN_IN_BLOCK = {
    SUSPENDED: { code: "account_suspended", message: "Your account has been suspended. Contact support if you think this is a mistake." },
    BANNED: { code: "account_banned", message: "Your account has been closed." },
} as const

/** The block that applies to this status, or null when the account can sign in. */
export function signInBlockFor(status: string): (typeof SIGN_IN_BLOCK)[keyof typeof SIGN_IN_BLOCK] | null {
    return status in SIGN_IN_BLOCK ? SIGN_IN_BLOCK[status as keyof typeof SIGN_IN_BLOCK] : null
}

/** The message for the `code` the sign-in call came back with; null for any other error. */
export function messageForSignInCode(code: unknown): string | null {
    return Object.values(SIGN_IN_BLOCK).find((b) => b.code === code)?.message ?? null
}

export type UserAction = "suspend" | "reinstate" | "ban" | "unban" | "revoke_sessions" | "reset_password"

/** The status a suspend / reinstate / ban / unban leads to from `from`, or null when it is not allowed from there. */
export function userMove(action: "suspend" | "reinstate" | "ban" | "unban", from: UserStatusValue): UserStatusValue | null {
    if (action === "suspend") return from === "ACTIVE" ? "SUSPENDED" : null
    if (action === "reinstate") return from === "SUSPENDED" ? "ACTIVE" : null
    // A ban can follow a suspension (the case was looked at and the answer is no)
    if (action === "ban") return from === "ACTIVE" || from === "SUSPENDED" ? "BANNED" : null
    return from === "BANNED" ? "ACTIVE" : null
}

/** The actions listed for a user in the admin list. Nobody acts on their own account from there. */
export function userActions(status: UserStatusValue, isSelf: boolean): UserAction[] {
    if (isSelf) return []
    if (status === "ACTIVE") return ["suspend", "ban", "revoke_sessions", "reset_password"]
    if (status === "SUSPENDED") return ["reinstate", "ban", "reset_password"]
    if (status === "BANNED") return ["unban"]
    return []
}

/** A person cannot suspend, sign out or lock themselves out of their own account. */
export function checkTarget(actorId: string, targetId: string): { ok: true } | { ok: false; error: string } {
    return actorId === targetId ? { ok: false, error: "You cannot do this to your own account" } : { ok: true }
}

export const REASON_MIN = 3
export const REASON_MAX = 300

/** A suspension or a ban always says why; the activity log keeps it (the person is only told the account is closed). */
export function parseReason(raw: unknown, what: "suspended" | "banned" = "suspended"): { ok: true; value: string } | { ok: false; error: string } {
    const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : ""
    if (value.length < REASON_MIN) return { ok: false, error: `Say why the account is ${what}` }
    if (value.length > REASON_MAX) return { ok: false, error: `The reason is too long (${REASON_MAX} characters at most)` }
    return { ok: true, value }
}
