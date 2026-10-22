// lib/access/roles-data.ts
// Reads for the roles screens: the roles of one owner (a business or a shop) with how many people
// and waiting invitations use each, and which ones this person may change. Server only.
import { prisma } from "@/lib/prisma"
import { missingKeys } from "./team-rules"

export type RoleRow = {
    id: string
    name: string
    description: string | null
    permissions: string[]
    members: number
    invites: number
    /** this person may edit or delete it: they manage roles here and hold every key it holds */
    editable: boolean
}

export type RolesOwner = { scope: "BUSINESS"; businessId: string } | { scope: "SHOP"; providerId: string }

export async function loadRoleRows(owner: RolesOwner, can: (key: string) => boolean, canManage: boolean): Promise<RoleRow[]> {
    const where = owner.scope === "BUSINESS" ? { scope: "BUSINESS" as const, businessId: owner.businessId } : { scope: "SHOP" as const, providerId: owner.providerId }
    const roles = await prisma.accessRole.findMany({
        where,
        select: { id: true, name: true, description: true, permissions: true },
    })
    const ids = roles.map((r) => r.id)
    const [members, invites] = ids.length
        ? await Promise.all([
            prisma.accessAssignment.groupBy({ by: ["roleId"], where: { roleId: { in: ids } }, _count: { _all: true } }),
            prisma.accessInvite.groupBy({ by: ["roleId"], where: { roleId: { in: ids }, status: "PENDING" }, _count: { _all: true } }),
        ])
        : [[], []]
    const memberCount = new Map(members.map((m) => [m.roleId, m._count._all]))
    const inviteCount = new Map(invites.map((m) => [m.roleId, m._count._all]))
    return roles
        .map((r) => ({
            ...r,
            members: memberCount.get(r.id) ?? 0,
            invites: inviteCount.get(r.id) ?? 0,
            editable: canManage && missingKeys(r.permissions, can).length === 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
