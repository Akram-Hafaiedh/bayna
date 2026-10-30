// lib/impersonation-session.ts
// The database side of "view as" (rules and wording: lib/impersonation.ts). Server only.
import { prisma } from "@/lib/prisma"
import type { ViewAs } from "@/lib/admin/impersonation"

/** Signing out ends a view the staff member left open (auth.ts calls this from its sign-out event). */
export async function endViewsOnSignOut(adminId: string, now: Date = new Date()): Promise<number> {
    const done = await prisma.impersonationSession.updateMany({
        where: { adminId, endedAt: null },
        data: { endedAt: now, endedBy: "SIGNED_OUT" },
    })
    return done.count
}

export type ViewedAccount = { id: string; name: string | null; email: string; role: string }

/**
 * The open "view as" session of this admin, with the person being viewed, or null. Called by auth.ts on every
 * session read for accounts whose role is ADMIN, so it stays to two small queries. A session whose person is no
 * longer active (suspended, closed) counts as ended.
 */
export async function resolveImpersonation(adminId: string, now: Date = new Date()): Promise<{ view: ViewAs; target: ViewedAccount } | null> {
    const s = await prisma.impersonationSession.findFirst({
        where: { adminId, endedAt: null, expiresAt: { gt: now } },
        orderBy: { startedAt: "desc" },
        select: { id: true, mode: true, expiresAt: true, targetUserId: true },
    })
    if (!s) return null
    const [target, admin] = await Promise.all([
        prisma.user.findFirst({
            where: { id: s.targetUserId, deletedAt: null, status: "ACTIVE" },
            select: { id: true, name: true, email: true, role: true },
        }),
        prisma.user.findUnique({ where: { id: adminId }, select: { name: true, email: true } }),
    ])
    if (!target || !admin) return null
    return {
        target,
        view: {
            id: s.id,
            mode: s.mode,
            expiresAt: s.expiresAt.toISOString(),
            adminId,
            adminName: admin.name || admin.email,
            targetName: target.name || target.email,
        },
    }
}
