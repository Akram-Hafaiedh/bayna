// lib/users/account-deletion.ts
// Deleting your own account. Pure (unit tested); the database side is lib/account-deletion-actions.ts and
// lib/account-erasure.ts.
//
//   1. The person asks from their profile with their password. The account becomes PENDING_DELETION, every
//      session ends, and the date it will be erased is shown.
//   2. For GRACE_DAYS they can change their mind: signing in again cancels the deletion.
//   3. After that the account is anonymised by `npm run db:purge-accounts`: the personal data goes, the row
//      stays (shops, products and the activity log still point at it), and the log shows "Deleted user".
//   A person who is the only owner of a shop, a business or the platform, or who has a shop application
//   waiting, has to hand over or close first, so nothing is left without an owner.
export const GRACE_DAYS = 14
const DAY = 24 * 60 * 60 * 1000

export const ANONYMISED_NAME = "Deleted user"
/** The address an anonymised account is left with. It cannot receive mail (.invalid) and cannot clash. */
export const anonymisedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`

export const purgeDate = (requestedAt: Date) => new Date(requestedAt.getTime() + GRACE_DAYS * DAY)
export const isDue = (requestedAt: Date, now: Date = new Date()) => purgeDate(requestedAt).getTime() <= now.getTime()
export function daysLeft(requestedAt: Date, now: Date = new Date()): number {
    return Math.max(0, Math.ceil((purgeDate(requestedAt).getTime() - now.getTime()) / DAY))
}

/** Signing in with the right password on an account waiting to be deleted cancels the deletion. */
export const signInCancelsDeletion = (status: string) => status === "PENDING_DELETION"

export type DeletionRequest = { password: string }

export function parseDeletionRequest(body: unknown): { ok: true; value: DeletionRequest } | { ok: false; error: string } {
    const password = body && typeof body === "object" ? (body as Record<string, unknown>).password : undefined
    if (typeof password !== "string" || password.length === 0) return { ok: false, error: "Enter your password to confirm" }
    return { ok: true, value: { password } }
}

/** Only an account in good standing deletes itself (a suspended or banned person cannot sign in to ask). */
export function checkCanRequest(input: { status: string; blockers: readonly string[] }): { ok: true } | { ok: false; error: string; blockers: string[] } {
    if (input.status !== "ACTIVE") return { ok: false, error: "This account cannot be deleted right now", blockers: [] }
    if (input.blockers.length > 0) {
        return { ok: false, error: "Before you delete your account, finish these:", blockers: [...input.blockers] }
    }
    return { ok: true }
}

export const blocker = {
    owner: (where: string) => `You are the only owner of ${where}. Make someone else an owner (transfer ownership) or close it first.`,
    platform: () => "You are the only owner of the Bayna platform. Make another Super admin first.",
    application: (shop: string) => `Your shop application "${shop}" is still waiting. Withdraw it first.`,
} as const
