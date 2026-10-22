// lib/access/role-actions.ts
// Server helpers for the role routes: the guard (who may manage the roles of a business or a shop),
// how many people use a role, and the "there is always an owner" check for a role edit.
import type { Tx } from "@/lib/audit/run"
import type { AuditActor } from "@/lib/audit/actor"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { OWNERSHIP_KEY } from "./catalogue"
import { isLive, type AssignmentInput } from "./evaluate"
import { requireBusiness, requireShop } from "./guard"
import { checkRoleEditKeepsOwner, type RoleMember } from "./role-rules"

export type RoleTarget = { scope: "BUSINESS"; businessId: string } | { scope: "SHOP"; providerId: string }

export type RoleGuard = {
    ok: true
    userId: string
    actor: AuditActor
    level: "BUSINESS" | "SHOP"
    /** the shop the role belongs to (shop roles only) */
    providerId: string | null
    businessId: string | null
    can: (key: string) => boolean
}
export type RoleGuardFail = { ok: false; error: string; status: 401 | 403 | 404 }

/**
 * Business roles are managed with business.role.*, shop roles with team.role.* in that shop (a
 * business-level role that holds it reaches every shop of its business). The person must really work there.
 */
export async function guardRoles(target: RoleTarget, name: "view" | "manage", req: Request): Promise<RoleGuard | RoleGuardFail> {
    if (target.scope === "BUSINESS") {
        const g = await requireBusiness(name === "manage" ? "business.role.manage" : "business.role.view", req, { businessId: target.businessId })
        if (!g.ok) return g
        return { ok: true, userId: g.userId, actor: g.actor, level: "BUSINESS", providerId: null, businessId: g.business.id, can: (k) => g.can(k as never) }
    }
    const g = await requireShop(name === "manage" ? "team.role.manage" : "team.role.view", req, { providerId: target.providerId })
    if (!g.ok) return g
    return { ok: true, userId: g.userId, actor: g.actor, level: "SHOP", providerId: g.provider.id, businessId: g.provider.businessId, can: (k) => g.can(k as never) }
}

/** The owner of a stored role as a target, or null for a platform role (those are not managed here). */
export function targetOfRole(role: { businessId: string | null; providerId: string | null }): RoleTarget | null {
    if (role.providerId) return { scope: "SHOP", providerId: role.providerId }
    if (role.businessId) return { scope: "BUSINESS", businessId: role.businessId }
    return null
}

/** People holding the role and invitations still waiting for it. */
export async function roleUsage(tx: Tx | typeof prisma, roleId: string): Promise<{ members: number; invites: number }> {
    const [members, invites] = await Promise.all([
        tx.accessAssignment.count({ where: { roleId } }),
        tx.accessInvite.count({ where: { roleId, status: "PENDING" } }),
    ])
    return { members, invites }
}

/**
 * Would saving `newPermissions` on this role leave its level without an owner? A business role is
 * measured against the business team; a shop role against the shop team plus the business-level team
 * of its business (a business owner owns every shop).
 */
export async function assertRoleEditKeepsOwner(
    tx: Tx,
    role: { id: string; businessId: string | null; providerId: string | null },
    newPermissions: readonly string[],
    now: Date = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
    let where: Prisma.AccessAssignmentWhereInput
    let key: string
    if (role.providerId) {
        const shop = await tx.shop.findUnique({ where: { id: role.providerId }, select: { businessId: true } })
        where = {
            OR: [
                { scope: "SHOP" as const, providerId: role.providerId },
                ...(shop?.businessId ? [{ scope: "BUSINESS" as const, businessId: shop.businessId }] : []),
            ],
        }
        key = OWNERSHIP_KEY.SHOP
    } else if (role.businessId) {
        where = { scope: "BUSINESS" as const, businessId: role.businessId }
        key = OWNERSHIP_KEY.BUSINESS
    } else {
        return { ok: true }
    }
    const rows = await tx.accessAssignment.findMany({
        where,
        select: {
            roleId: true,
            scope: true,
            providerId: true,
            businessId: true,
            status: true,
            expiresAt: true,
            role: { select: { name: true, permissions: true } },
            user: { select: { status: true, deletedAt: true } },
        },
    })
    const members: RoleMember[] = rows.map((r) => {
        const input: AssignmentInput = r
        return {
            roleId: r.roleId,
            permissions: r.role.permissions,
            live: isLive(input, now) && r.user.status === "ACTIVE" && r.user.deletedAt === null,
        }
    })
    return checkRoleEditKeepsOwner(members, role.id, newPermissions, key)
}
