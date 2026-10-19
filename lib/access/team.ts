// lib/access/team.ts
// Reads for the team page: the people at one level (a business or a shop), their pending invites,
// and the roles that can be handed out. Server only. Writes live in the team routes.
import { prisma } from "@/lib/prisma"
import { inviteState, type InviteState } from "./invite-token"
import type { TeamScope } from "./team-rules"

export type TeamTarget = { scope: "SHOP"; providerId: string } | { scope: "BUSINESS"; businessId: string }

export type TeamMember = {
    /** the assignment id: what the member routes act on */
    id: string
    userId: string
    name: string | null
    email: string
    roleId: string
    roleKey: string
    roleName: string
    rolePermissions: string[]
    status: "ACTIVE" | "SUSPENDED" | "INVITED"
    /** the person's account itself is closed or deleted */
    accountClosed: boolean
    since: Date
}

export type TeamInvite = {
    id: string
    email: string
    roleKey: string
    roleName: string
    state: InviteState
    expiresAt: Date
    invitedByName: string | null
    createdAt: Date
}

export type RoleOption = { id: string; key: string; name: string; description: string | null; permissions: string[] }

const where = (t: TeamTarget) =>
    t.scope === "SHOP" ? { scope: "SHOP" as const, providerId: t.providerId } : { scope: "BUSINESS" as const, businessId: t.businessId }

/** Owners first, then by name. */
function byRank(a: TeamMember, b: TeamMember): number {
    const rank = (m: TeamMember) => (m.roleKey === "OWNER" ? 0 : 1)
    return rank(a) - rank(b) || (a.name ?? a.email).localeCompare(b.name ?? b.email) || a.id.localeCompare(b.id)
}

export async function loadMembers(target: TeamTarget): Promise<TeamMember[]> {
    const rows = await prisma.accessAssignment.findMany({
        where: where(target),
        select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            role: { select: { id: true, key: true, name: true, permissions: true } },
            user: { select: { name: true, email: true, status: true, deletedAt: true } },
        },
    })
    return rows
        .map((r) => ({
            id: r.id,
            userId: r.userId,
            name: r.user.name,
            email: r.user.email,
            roleId: r.role.id,
            roleKey: r.role.key,
            roleName: r.role.name,
            rolePermissions: r.role.permissions,
            status: r.status,
            accountClosed: r.user.status !== "ACTIVE" || r.user.deletedAt !== null,
            since: r.createdAt,
        }))
        .sort(byRank)
}

export async function loadInvites(target: TeamTarget, now: Date = new Date()): Promise<TeamInvite[]> {
    const rows = await prisma.accessInvite.findMany({
        where: { ...where(target), status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            invitedById: true,
            role: { select: { key: true, name: true } },
        },
    })
    const ids = [...new Set(rows.flatMap((r) => (r.invitedById ? [r.invitedById] : [])))]
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : []
    const nameOf = new Map(people.map((p) => [p.id, p.name || p.email]))
    return rows.map((r) => ({
        id: r.id,
        email: r.email,
        roleKey: r.role.key,
        roleName: r.role.name,
        state: inviteState(r, now),
        expiresAt: r.expiresAt,
        invitedByName: r.invitedById ? (nameOf.get(r.invitedById) ?? null) : null,
        createdAt: r.createdAt,
    }))
}

/** The system roles of a level, for the role pickers. */
export async function loadRoleOptions(scope: TeamScope): Promise<RoleOption[]> {
    const order = ["OWNER", "MANAGER", "ORDER_HANDLER", "INVENTORY_CLERK", "ACCOUNTANT", "VIEWER"]
    const rows = await prisma.accessRole.findMany({
        where: { scope, providerId: null },
        select: { id: true, key: true, name: true, description: true, permissions: true },
    })
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length)
    return rows.sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name))
}
