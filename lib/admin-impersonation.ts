// lib/admin-impersonation.ts
// Reads one page of "View as" sessions for the admin list (Server Components only).
import { prisma } from "@/lib/prisma"
import { sessionWhere, type SessionQuery } from "@/lib/impersonation-list"

export type SessionRow = {
    id: string
    mode: string
    reason: string
    startedAt: string
    expiresAt: string
    endedAt: string | null
    endedBy: string | null
    ip: string | null
    admin: { id: string; name: string }
    target: { id: string; publicUserId: string | null; name: string }
}
export type SessionPage = { items: SessionRow[]; total: number; page: number; pageCount: number; pageSize: number }

export async function listSessions(query: SessionQuery, now: Date = new Date()): Promise<SessionPage> {
    const where = sessionWhere(query, now)
    const total = await prisma.impersonationSession.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
    const page = Math.min(query.page, pageCount)

    const rows = await prisma.impersonationSession.findMany({
        where,
        orderBy: [{ startedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
    })
    // The table keeps plain ids (no foreign keys, like the other audit columns), so the people are read in one query
    const ids = [...new Set(rows.flatMap((r) => [r.adminId, r.targetUserId]))]
    const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, publicUserId: true } })
    const byId = new Map(people.map((p) => [p.id, p]))
    const nameOf = (id: string) => {
        const p = byId.get(id)
        return p ? p.name || p.email : "Deleted account"
    }
    return {
        items: rows.map((r) => ({
            id: r.id,
            mode: r.mode,
            reason: r.reason,
            startedAt: r.startedAt.toISOString(),
            expiresAt: r.expiresAt.toISOString(),
            endedAt: r.endedAt ? r.endedAt.toISOString() : null,
            endedBy: r.endedBy,
            ip: r.ip,
            admin: { id: r.adminId, name: nameOf(r.adminId) },
            target: { id: r.targetUserId, publicUserId: byId.get(r.targetUserId)?.publicUserId ?? null, name: nameOf(r.targetUserId) },
        })),
        total,
        page,
        pageCount,
        pageSize: query.pageSize,
    }
}
