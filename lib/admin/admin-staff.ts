// lib/admin/admin-staff.ts
// What the Staff page shows: the people who work for Bayna, their invitations, and the platform roles the
// signed-in person may hand out. Server only. The rules are in lib/access/staff-rules.ts.
import { prisma } from "@/lib/prisma"
import { loadAccess } from "@/lib/access/load"
import { effective, has } from "@/lib/access/evaluate"
import { missingKeys } from "@/lib/access/team-rules"

export type StaffMember = {
    assignmentId: string
    userId: string
    name: string | null
    email: string
    roleId: string
    roleName: string
    status: "ACTIVE" | "SUSPENDED" | "INVITED"
    accountStatus: string
    since: string
    /** the signed-in person holds every permission of this person's role, so may change them */
    canTouch: boolean
}

export type StaffInviteRow = { id: string; email: string; roleName: string; expiresAt: string }
export type StaffRoleOption = { id: string; name: string; description: string | null }

export async function loadStaffPage(actorId: string): Promise<{ members: StaffMember[]; invites: StaffInviteRow[]; roles: StaffRoleOption[] }> {
    const access = await loadAccess(actorId)
    const eff = effective(access?.assignments ?? [], {}, new Date())
    const can = (k: string) => has(eff, k)

    const [rows, invites, roles] = await Promise.all([
        prisma.accessAssignment.findMany({
            where: { scope: "PLATFORM" },
            orderBy: { createdAt: "asc" },
            select: {
                id: true, userId: true, status: true, createdAt: true,
                role: { select: { id: true, name: true, permissions: true } },
                user: { select: { name: true, email: true, status: true } },
            },
        }),
        prisma.accessInvite.findMany({
            where: { scope: "PLATFORM", status: "PENDING", expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            select: { id: true, email: true, expiresAt: true, role: { select: { name: true } } },
        }),
        prisma.accessRole.findMany({
            where: { scope: "PLATFORM" },
            orderBy: { name: "asc" },
            select: { id: true, name: true, description: true, permissions: true },
        }),
    ])

    return {
        members: rows.map((r) => ({
            assignmentId: r.id,
            userId: r.userId,
            name: r.user.name,
            email: r.user.email,
            roleId: r.role.id,
            roleName: r.role.name,
            status: r.status,
            accountStatus: r.user.status,
            since: r.createdAt.toISOString(),
            canTouch: r.userId !== actorId && missingKeys(r.role.permissions, can).length === 0,
        })),
        invites: invites.map((i) => ({ id: i.id, email: i.email, roleName: i.role.name, expiresAt: i.expiresAt.toISOString() })),
        // Only roles whose every permission the person holds themselves: nobody hands out more than they have
        roles: roles.filter((r) => missingKeys(r.permissions, can).length === 0).map(({ id, name, description }) => ({ id, name, description })),
    }
}
