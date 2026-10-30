// lib/admin-users.ts
// Reads one page of users for the admin Users list (Server Components only).
import { prisma } from "@/lib/prisma"
import { userWhere, type UserQuery, type UserRow } from "@/lib/users/user-list"

export type UserPage = { items: UserRow[]; total: number; page: number; pageCount: number; pageSize: number }

export async function listUsers(query: UserQuery): Promise<UserPage> {
    const where = userWhere(query)
    const total = await prisma.user.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
    const page = Math.min(query.page, pageCount) // out-of-range page -> last page

    const rows = await prisma.user.findMany({
        where,
        select: {
            id: true, publicUserId: true, email: true, name: true, phone: true, role: true, status: true, suspendedReason: true, createdAt: true,
            appliedShops: { where: { deletedAt: null }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "asc" } },
        },
        // id as tie-breaker keeps pages stable when several accounts share a date
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
    })
    return {
        items: rows.map(({ appliedShops, ...r }) => ({ ...r, shops: appliedShops, createdAt: r.createdAt.toISOString() })),
        total,
        page,
        pageCount,
        pageSize: query.pageSize,
    }
}
