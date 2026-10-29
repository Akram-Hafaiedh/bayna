// lib/admin-user-detail.ts
// Reads everything the admin user detail page shows (Server Components only). Read-only.
import { prisma } from "@/lib/prisma"

export const DETAIL_SESSIONS = 10
export const DETAIL_ACTIVITY = 30

export async function getUserDetail(publicUserId: string) {
    const user = await prisma.user.findUnique({
        where: { publicUserId },
        select: {
            id: true, publicUserId: true, email: true, name: true, phone: true, role: true, status: true, suspendedReason: true,
            emailVerified: true, createdAt: true, lastLoginAt: true, passwordChangedAt: true, deletedAt: true,
            deletionRequestedAt: true, termsAcceptedAt: true, termsVersion: true, locale: true, timezone: true,
            password: true,
        },
    })
    if (!user) return null

    const [assignments, shops, sessions, activity] = await Promise.all([
        prisma.accessAssignment.findMany({
            where: { userId: user.id },
            orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
            select: {
                id: true, scope: true, status: true, expiresAt: true, createdAt: true,
                role: { select: { name: true } },
                provider: { select: { name: true } },
                business: { select: { name: true } },
            },
        }),
        prisma.shop.findMany({
            where: { userId: user.id, deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, status: true, createdAt: true },
        }),
        prisma.loginSession.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: DETAIL_SESSIONS,
            select: { id: true, deviceLabel: true, userAgent: true, ip: true, createdAt: true, lastActiveAt: true, revokedAt: true },
        }),
        // What happened to the account and what the person did. Row changes of other tables the person touched
        // stay in those tables' own feeds.
        prisma.activityLog.findMany({
            where: { OR: [{ entityType: "User", entityId: user.id }, { actorId: user.id }] },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: DETAIL_ACTIVITY,
            select: {
                id: true, createdAt: true, entityType: true, entityId: true, action: true, changes: true, note: true,
                actorName: true, actorRole: true, source: true, onBehalfOfId: true,
            },
        }),
    ])
    const { password, ...rest } = user
    return { ...rest, hasPassword: !!password, assignments, shops, sessions, activity }
}
