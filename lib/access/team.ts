// lib/access/team.ts
// Reads for the team page: the people at one level (a business or a shop), their pending invites,
// and the roles that can be handed out. Server only. Writes live in the team routes.
import { prisma } from "@/lib/prisma"
import { OWNERSHIP_KEY, holdsKey } from "./catalogue"
import { inviteState, type InviteState } from "./invite-token"
import type { RoleTarget } from "./team-rules"

export type TeamTarget = { scope: "SHOP"; providerId: string } | { scope: "BUSINESS"; businessId: string }

export type TeamMember = {
    /** the assignment id: what the member routes act on */
    id: string
    userId: string
    name: string | null
    email: string
    roleId: string
    roleName: string
    rolePermissions: string[]
    /** the role holds the ownership key of this level (shown first in the list) */
    isOwner: boolean
    status: "ACTIVE" | "SUSPENDED" | "INVITED"
    /** the person's account itself is closed or deleted */
    accountClosed: boolean
    since: Date
}

export type TeamInvite = {
    id: string
    email: string
    roleId: string
    roleName: string
    state: InviteState
    expiresAt: Date
    invitedByName: string | null
    createdAt: Date
}

export type RoleOption = {
    id: string
    name: string
    /** what the pickers show: a business role offered inside a shop says so */
    label: string
    description: string | null
    permissions: string[]
    ownedBy: "business" | "shop"
}

const where = (t: TeamTarget) =>
    t.scope === "SHOP" ? { scope: "SHOP" as const, providerId: t.providerId } : { scope: "BUSINESS" as const, businessId: t.businessId }

/** Owners first, then by name. */
function byRank(a: TeamMember, b: TeamMember): number {
    const rank = (m: TeamMember) => (m.isOwner ? 0 : 1)
    return rank(a) - rank(b) || (a.name ?? a.email).localeCompare(b.name ?? b.email) || a.id.localeCompare(b.id)
}

export async function loadMembers(target: TeamTarget): Promise<TeamMember[]> {
    const ownerKey = OWNERSHIP_KEY[target.scope]
    const rows = await prisma.accessAssignment.findMany({
        where: where(target),
        select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            role: { select: { id: true, name: true, permissions: true } },
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
            roleName: r.role.name,
            rolePermissions: r.role.permissions,
            isOwner: holdsKey(r.role.permissions, ownerKey),
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
            role: { select: { id: true, name: true } },
        },
    })
    const ids = [...new Set(rows.flatMap((r) => (r.invitedById ? [r.invitedById] : [])))]
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : []
    const nameOf = new Map(people.map((p) => [p.id, p.name || p.email]))
    return rows.map((r) => ({
        id: r.id,
        email: r.email,
        roleId: r.role.id,
        roleName: r.role.name,
        state: inviteState(r, now),
        expiresAt: r.expiresAt,
        invitedByName: r.invitedById ? (nameOf.get(r.invitedById) ?? null) : null,
        createdAt: r.createdAt,
    }))
}

/**
 * The roles that can be given at this place: for a business, its own roles; for a shop, the shop's own
 * roles and the roles of its business. Owners (roles that hold the ownership key) first, then by name.
 */
export async function loadRoleOptions(target: RoleTarget): Promise<RoleOption[]> {
    const where =
        target.scope === "BUSINESS"
            ? { scope: "BUSINESS" as const, businessId: target.businessId }
            : {
                OR: [
                    { scope: "SHOP" as const, providerId: target.providerId },
                    ...(target.businessId ? [{ scope: "BUSINESS" as const, businessId: target.businessId, providerId: null }] : []),
                ],
            }
    const rows = await prisma.accessRole.findMany({
        where,
        select: { id: true, name: true, description: true, permissions: true, scope: true },
    })
    const ownerKey = OWNERSHIP_KEY[target.scope]
    const options: RoleOption[] = rows.map((r) => {
        const ownedBy = r.scope === "BUSINESS" ? ("business" as const) : ("shop" as const)
        return {
            id: r.id,
            name: r.name,
            label: target.scope === "SHOP" && ownedBy === "business" ? `${r.name} (business role)` : r.name,
            description: r.description,
            permissions: r.permissions,
            ownedBy,
        }
    })
    const rank = (o: RoleOption) => (holdsKey(o.permissions, ownerKey) ? 0 : 1)
    return options.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}
