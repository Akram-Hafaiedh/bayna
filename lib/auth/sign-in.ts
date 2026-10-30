// lib/sign-in.ts
// The rules for signing in with an email and a password (the Credentials provider in auth.ts calls this). Kept out of
// auth.ts so the tests can call it directly. Server only.
//
//   1. Too many failed tries from this address or for this email: refused before anything is looked up.
//   2. Unknown email, no password, or wrong password: null (the same answer for all three) and the try is counted.
//   3. Right password, but the account is suspended or banned: refused with a code. Saying why is safe here,
//      because the password was right, so it does not reveal that an email has an account.
//   4. Right password on an account waiting to be deleted: the deletion is cancelled and the person is in.
//   5. Otherwise: in, and the per-email counter is cleared.
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeEmail } from "@/lib/auth/email-input"
import { signInBlockFor } from "@/lib/users/user-status"
import { signInCancelsDeletion } from "@/lib/users/account-deletion"
import { withAudit, logActivity } from "@/lib/audit/run"
import { notify, notifications } from "@/lib/notifications"
import { RATE, RATE_LIMITED_CODE, checkRateLimits, clearRateLimit, clientIp, recordRateLimits } from "@/lib/rate-limit"
import type { Role } from "@/app/generated/prisma/enums"

/** A sign-in refused on purpose. `code` is what the login page turns into a message (lib/user-status.ts, lib/rate-limit). */
export class SignInRefused extends Error {
    constructor(public readonly code: string) {
        super(code)
        this.name = "SignInRefused"
    }
}

export type SignedIn = { id: string; email: string; name: string | null; role: Role }

export async function authorizeCredentials(
    credentials: Partial<Record<string, unknown>> | undefined,
    request: Request
): Promise<SignedIn | null> {
    if (!credentials?.email || !credentials?.password) {
        return null
    }

    const email = normalizeEmail(String(credentials.email))

    // Per IP stops one machine trying many accounts; per email stops many machines trying one.
    // Only FAILED tries are counted (below), so good sign-ins never use up the budget. Once a
    // budget is spent even the right password is refused until the window ends. That is the point.
    const attempt = [
        { policy: RATE.loginIp, subject: clientIp(request) },
        { policy: RATE.loginEmail, subject: email },
    ]
    // Before the lookup and the (slow) password check, so a flood costs almost nothing
    const limited = await checkRateLimits(attempt)
    if (!limited.ok) throw new SignInRefused(RATE_LIMITED_CODE)
    // Exact match first; the case-insensitive lookup covers accounts saved before
    // emails were normalised (see scripts/normalize-emails.ts)
    const user =
        (await prisma.user.findUnique({ where: { email } })) ??
        (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }))

    if (!user || !user.password) {
        // Unknown emails count too, so the limit looks the same for every address
        await recordRateLimits(attempt)
        return null
    }

    const isValid = await bcrypt.compare(String(credentials.password), user.password)

    if (!isValid) {
        await recordRateLimits(attempt)
        return null
    }

    // A suspended or banned account cannot sign in. The password was right, so saying why
    // does not reveal that the email has an account.
    const blocked = signInBlockFor(user.status)
    if (blocked) throw new SignInRefused(blocked.code)

    // Signing in during the grace period cancels the deletion the person asked for
    if (signInCancelsDeletion(user.status)) {
        const actor = { actorId: user.id, actorName: user.name ?? user.email, source: "WEB" as const }
        await withAudit(actor, async (tx) => {
            const back = await tx.user.updateMany({
                where: { id: user.id, status: "PENDING_DELETION", deletedAt: null },
                data: { status: "ACTIVE", deletionRequestedAt: null },
            })
            if (back.count === 0) return
            await logActivity(tx, actor, { entityType: "User", entityId: user.id, action: "ACCOUNT_DELETION_CANCELLED", note: "Signed in during the grace period" })
            await notify(tx, user.id, notifications.accountDeletionCancelled())
        })
    } else if (user.status !== "ACTIVE") return null

    // A good sign-in clears the per-email counter, so a person who mistyped is not locked out
    await clearRateLimit(RATE.loginEmail, email)

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    }
}
