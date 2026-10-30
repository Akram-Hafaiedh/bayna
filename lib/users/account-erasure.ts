// lib/account-erasure.ts
// Anonymises accounts whose grace period is over. Run by `npm run db:purge-accounts` (put it on a daily
// schedule once there is a place to run one). Relative imports only, so the script can use it.
//
// What goes: name, email, phone, password, picture, preferences, sign-in methods, sessions, notifications,
// team and staff roles, reset and invitation links, and messages sent from the Contact page. What stays: the
// account row itself (shops, products and records still point at it) with the address
// deleted-<id>@deleted.invalid and the name "Deleted user", and the activity log, with the person's name,
// address and browser removed from it. Names written inside other people's log notes are not rewritten.
import type { PrismaClient } from "../../app/generated/prisma/client"
import type { Tx } from "../audit/run"
import { serializeActor, systemActor } from "../audit/actor"
import { ANONYMISED_NAME, anonymisedEmail, isDue } from "./account-deletion"
import { deletionBlockers } from "./account-deletion-actions"

export type PurgeResult = { purged: string[]; skipped: { id: string; reason: string }[] }

/** Anonymise one account inside a transaction. The caller has checked it is due and has no blockers. */
export async function anonymiseAccount(tx: Tx, userId: string): Promise<void> {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user) return
    const oldEmail = user.email

    await tx.$executeRaw`SELECT set_config('app.audit', ${serializeActor(systemActor("JOB", "Account purge"))}, true)`

    await tx.$executeRaw`
        UPDATE "User" SET
            "email" = ${anonymisedEmail(userId)}, "name" = ${ANONYMISED_NAME}, "phone" = NULL, "password" = NULL, "image" = NULL,
            "emailVerified" = NULL, "suspendedReason" = NULL, "locale" = NULL, "timezone" = NULL, "preferences" = NULL,
            "deletionRequestedAt" = NULL, "deletedAt" = now()
        WHERE "id" = ${userId}`

    await tx.account.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.loginSession.deleteMany({ where: { userId } })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.accessAssignment.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { email: oldEmail } })
    await tx.verificationToken.deleteMany({ where: { identifier: oldEmail } })
    await tx.accessInvite.deleteMany({ where: { email: oldEmail } })
    await tx.contactMessage.deleteMany({ where: { OR: [{ userId }, { email: oldEmail }] } })

    // The log is append-only; this erasure job lifts the guard for this transaction only
    await tx.$executeRaw`SELECT set_config('app.audit_maintenance', 'on', true)`
    await tx.$executeRaw`UPDATE "ActivityLog" SET "actorName" = ${ANONYMISED_NAME}, "ip" = NULL, "userAgent" = NULL WHERE "actorId" = ${userId}`
    await tx.$executeRaw`UPDATE "ActivityLog" SET "changes" = NULL, "note" = NULL WHERE "entityType" IN ('User', 'LoginSession', 'Account') AND ("entityId" = ${userId} OR "actorId" = ${userId})`
    await tx.$executeRaw`SELECT set_config('app.audit_maintenance', 'off', true)`

    await tx.activityLog.create({
        data: { entityType: "User", entityId: userId, action: "ACCOUNT_ANONYMISED", note: "Account anonymised after the grace period", actorName: "Account purge", source: "JOB" },
    })
}

/** Anonymise every account whose grace period is over, unless it has become the only owner of something. */
export async function purgeDueAccounts(prisma: PrismaClient, now: Date = new Date()): Promise<PurgeResult> {
    const pending = await prisma.user.findMany({
        where: { status: "PENDING_DELETION", deletedAt: null, deletionRequestedAt: { not: null } },
        select: { id: true, deletionRequestedAt: true },
    })
    const result: PurgeResult = { purged: [], skipped: [] }
    for (const p of pending) {
        if (!p.deletionRequestedAt || !isDue(p.deletionRequestedAt, now)) continue
        try {
            const outcome = await prisma.$transaction(async (tx) => {
                // Checked again: since the request someone may have left them as the only owner
                const blockers = await deletionBlockers(tx, p.id, now)
                if (blockers.length > 0) return blockers[0]
                await anonymiseAccount(tx, p.id)
                return null
            })
            if (outcome) result.skipped.push({ id: p.id, reason: outcome })
            else result.purged.push(p.id)
        } catch (e) {
            result.skipped.push({ id: p.id, reason: e instanceof Error ? e.message : "failed" })
        }
    }
    return result
}
